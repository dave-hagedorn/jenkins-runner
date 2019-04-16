/**
 * Copyright (c) [2019] [Dave Hagedorn]
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const jenkins = require("jenkins");
import * as url from "url";
import * as xml2js from "xml2js";
import * as util from "util";
import { GroovyError, parseGroovyErrors } from "./pipeline_error_parser";
import * as log from "./log";
import * as utils from "./utils";

const timeout = util.promisify(setTimeout);

const BUILD_FETCH_RETRIES = 10;

const parseXmlString = util.promisify(xml2js.parseString) as any as (xml: string) => any;

const logger = new log.Logger("Jenkins");

export default class Jenkins {
    private jenkinsInstance: any;
    private _builds: PipelineBuild[] = [];

    private static readonly TAG = "Jenkins";

    private static _hosts = new Map<string,Jenkins>();

    public static getOrCreateHost(baseUrl: string, user?: string) {
        let key = `${baseUrl}-${user}`;

        if (!this._hosts.has(key)) {
            this._hosts.set(key, new Jenkins(baseUrl, user));
        }

        return this._hosts.get(key) as Jenkins;
    }

    public static get hosts() {
        return this._hosts as ReadonlyMap<string,Jenkins>;
    }

    public get builds() {
        return this._builds as ReadonlyArray<PipelineBuild>;
    }

    public get description() {
        return `${this.user !== undefined ? `${this.user}@` : ""}${this.baseUrl}`;
    }

    public password?: String;

    private constructor(
        public readonly baseUrl: string,
        public readonly user?: string,
    ) {
    }

    public updatePassword(password?: string) {
        let urlWithAuth = new url.URL(this.baseUrl);

        if (password !== undefined && this.user !== undefined) {
            urlWithAuth.password = password;
            urlWithAuth.username = this.user;
        } else if (this.user === undefined && password === undefined) {
        } else {
            logger.error("Jenkins instance created with password and no user, or user and no password - need both or none");
            throw new Error("invalid arguments");
        }

        const combinedUrl = urlWithAuth.href;

        // don't log passwords!
        logger.info(`Creating Jenkins instance @url=${this.baseUrl}, with user=${this.user}, password=${password ? "****" : ""}`);
        this.jenkinsInstance = jenkins({baseUrl: combinedUrl, promisify: true, crumbIssuer: true});
    }

    public async createPipelineBuild(
        usingJob: string,
        withScript: string,
        logHandler: LogHandler,
        doneHandler: DoneHandler,
        parameters?: any,
    ) {
        let build = new PipelineBuild(this, this.jenkinsInstance, usingJob, withScript, logHandler, doneHandler, parameters);
        this._builds.push(build);
        return build;
    }

    public destroy(build: PipelineBuild) {
        if (this._builds.indexOf(build) >= 0) {
            this._builds = this._builds.filter(e => e !== build);
            build.destroy();
        }
    }
}

type LogHandler = (logLine: string) => void;
type DoneHandler = (error?: Error) => void;

class PipelineBuild {
    private buildNumber?: number;
    private _errors: GroovyError[] = [];
    private buildLog = "";

    private state: "running"|"stopped" = "stopped";

    private static readonly TAG = "PipelineBuild";

    private logStream: any;

    public get errors() {
        return this._errors as ReadonlyArray<GroovyError>;
    }

    public get running() {
        return this.state === "running";
    }

    public get description() {
        return `${this.usingJob} ${this.buildNumber !== undefined ? `#${this.buildNumber}` : ""} on ${this.jenkins.description}`;
    }

    constructor(
        private jenkins: Jenkins,
        private jenkinsInstance: any,
        private usingJob: string,
        private withScript: string,
        private logHandler: LogHandler,
        private doneHandler?: DoneHandler,
        private parameters?: any,
        ) {
        logger.info(`Creating pipeline build using job ${usingJob} @${jenkins.baseUrl}, with params ${parameters}`);
    }

    private async updateJobScript(jobName: string, script: string) {

        logger.info(`Fetching remote XML config for job ${this.usingJob} @${this.jenkins.baseUrl}`);
        let jobXml = await this.jenkinsInstance.job.config(jobName) as string;

        logger.info("Parsing and updating XML with new pipeline script");
        let parsed = await parseXmlString(jobXml);

        let root = parsed["flow-definition"];

        root.definition[0].script = script;
        root.quietPeriod = 0; // make sure job starts right away

        jobXml = new xml2js.Builder().buildObject(parsed);

        logger.info(`Pushing remote XML config for job ${this.usingJob} @${this.jenkins.baseUrl}`);
        await this.jenkinsInstance.job.config(jobName, jobXml);
    }

    private async postDone(error?: Error) {
        this.state = "stopped";

        logger.info(`Done job ${this.usingJob} #${this.buildNumber} @${this.jenkins.baseUrl}`);
        if (error) {
            logger.error(`Build finished with errors: ${error.message}`);
        }

        logger.info("Fetching full build log...");
        this.buildLog = await this.jenkinsInstance.build.log(this.usingJob, this.buildNumber);

        logger.info("Parsing build log for errors...");
        this._errors = parseGroovyErrors(this.buildLog);
        if (this.doneHandler) {
            this.doneHandler(error);
        }
    }

    async start() {
        if (this.buildNumber !== undefined) {
            const msg = `Trying to start build for job ${this.usingJob} - but has already been started with #${this.buildNumber}`;
            logger.error(msg);
            throw new Error(msg);
        }

        try {
            await this.updateJobScript(this.usingJob, this.withScript);

            logger.info(`Fetching next job number job ${this.usingJob} @${this.jenkins.baseUrl}`);
            // TODO:  Race condition - this requires that no other build starts between now and the below line !!!
            this.buildNumber = (await this.jenkinsInstance.job.get(this.usingJob)).nextBuildNumber;
            logger.info(`Next job number: ${this.buildNumber}`);

            logger.info(`Starting build #${this.buildNumber} of job ${this.usingJob} @${this.jenkins.baseUrl}`);
            await this.jenkinsInstance.job.build({
                name: this.usingJob,
                parameters: this.parameters,
            });


            let fetchCount = 0;
            let build = undefined;
            while (fetchCount++ < BUILD_FETCH_RETRIES) {
                try {
                    logger.info(`Trying to fetch build #${this.buildNumber}...`);
                    build = await this.jenkinsInstance.build.get(this.usingJob, this.buildNumber);
                    break;
                } catch(error) {
                    logger.warn(`Build probably not started yet, will try again...`);
                    await timeout(100);
                }
            }
            if (!build) {
                logger.error(`Could not find build #${this.buildNumber}`);
                if (this.doneHandler) {
                    this.doneHandler(new Error("Could not start build"));
                }
                return;
            }

            logger.info(`Fetching build output stream for build #${this.buildNumber}`);
            this.logStream = this.jenkinsInstance.build.logStream(this.usingJob, this.buildNumber);
            this.logStream.on("data", (text: string) => this.logHandler(text));
            this.logStream.on("end", () => this.postDone());
            this.logStream.on("error", (error: Error) => this.postDone(error));

            this.state = "running";
        } catch (error) {
            logger.error(`Error starting job ${this.usingJob} #${this.buildNumber} @${this.jenkins.baseUrl}}: ${error}`);
            let detailed = utils.atPath(error, "res", "body");
            if (detailed) {
                logger.error(detailed);
            }
            if (this.doneHandler) {
                this.doneHandler(error);
            }
        }
    }

    async stop() {
        logger.info(`Stopping job ${this.usingJob} #${this.buildNumber} @${this.jenkins.baseUrl}`);
        await this.jenkinsInstance.build.stop(this.usingJob, this.buildNumber);
    }

    public destroy() {
        this.stop();
        this.logStream = undefined;
        this.doneHandler = undefined;
        this.jenkins.destroy(this);
    }
}
