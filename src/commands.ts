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

import * as vscode from "vscode";
import Settings, { Job, HostConfig } from "./settings";
import Jenkins from "./jenkins";
import * as log from "./log";
import Constants from "./constants";

const cachedPasswords = new Map<string,string>();

const outputChannel = vscode.window.createOutputChannel(Constants.PLUGIN_FRIENDLY_NAME);

const diagnostics = vscode.languages.createDiagnosticCollection(Constants.PLUGIN_FRIENDLY_NAME);

let statusBarTimer: NodeJS.Timer|undefined;

const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
statusBarIdle();

function statusBarIdle() {
    statusBar.command = runPipelineScriptOn.name;
    statusBar.text = Constants.STATUS_BAR_IDLE;
    statusBar.color = "white";
    statusBar.tooltip = "Launch Jenkins Job";
    statusBar.show();

    if (statusBarTimer) {
        clearInterval(statusBarTimer);
        statusBarTimer = undefined;
    }
}

function statusBarRunning(description: string) {
    statusBar.command = showPipelineLog.name;
    statusBar.text = Constants.STATUS_BAR_RUNNING("zap", description);
    statusBar.color = "white";
    statusBar.tooltip = "Show Log";
    statusBar.show();

    let tick = 1;
    statusBarTimer = setInterval(() => {
        statusBar.text = Constants.STATUS_BAR_RUNNING(tick % 2 ? "zap" : "file", description);
        tick++;
    }, 1000);
}

async function runPipelineScriptOnJob(textEditor: vscode.TextEditor, job: Job) {
    let pipelineScript = textEditor.document.getText();

    let hostDescription = (host: HostConfig) => `${host.friendlyName} - ${host.user ? host.user + "@" : ""}${host.url}`;

    let host: HostConfig;
    if (1 === job.runWith.length) {
        host = job.runWith[0];
    } else {
        let hostChoices = job.runWith.map(hostDescription);
        let choice = await vscode.window.showQuickPick(hostChoices, {placeHolder:`Pick host to run ${job.friendlyName} on`});

        if (undefined === choice) {
            return;
        }

        host = job.runWith[hostChoices.indexOf(choice)];
    }

    let jenkinsHost = Jenkins.getOrCreateHost(host.url, host.user);

    let password = undefined;
    if (host.password !== undefined) {
        password = host.password
    } else if (host.user !== undefined) {
        if (!cachedPasswords.has(host.friendlyName)) {
            let tempPassword = await vscode.window.showInputBox({prompt: `Password for ${hostDescription(host)}`, password: true});
            if (undefined === tempPassword) {
                return;
            }

            cachedPasswords.set(host.friendlyName, tempPassword);
        }
        password = cachedPasswords.get(host.friendlyName);
    } else {
        // else, updatePassword still creates internal jenkins object
        // TODO:  write some unit tests..
        password = undefined;
    }

    jenkinsHost.updateCredentials(host.useCrumbIssuer, host.rejectUnauthorizedCert, password);


    statusBarRunning(`${job.friendlyName} - ${job.name} on ${hostDescription(host)}`);
    if (Settings.clearOutputOnRun) {
        outputChannel.clear();
    }
    outputChannel.show(true);

    let onDone = async (error?: Error) => {
        statusBarIdle();

        if (error) {
            let action = await vscode.window.showErrorMessage(error.message, "Show Logs");
            if ("Show Logs" === action) {
                log.showPanel();
            }
        }

        diagnostics.set(textEditor.document.uri, build.errors.map(e => (
            new vscode.Diagnostic(new vscode.Range(e.line-1, e.column, e.line-1, 1000), e.message, vscode.DiagnosticSeverity.Error)
            ))
        );

        build.destroy();
    };

    let build = await jenkinsHost.createPipelineBuild(
        job.name,
        pipelineScript,
        text => outputChannel.append(text),
        error => onDone(error),
        job.parameters
    );

    diagnostics.clear();
    build.start();
}

async function getJobs() {
    try {
        let [jobs, warnings] = Settings.jobs;
        if (warnings.length > 0) {
            let action = await vscode.window.showWarningMessage("Warnings while parsing settings - inspect log", "Show Logs");
            if ("Show Logs" === action) {
                log.showPanel();
            }
        } else if (jobs.size === 0) {
            vscode.window.showErrorMessage("No jobs defined in settings.json")
        }
        return jobs;
    } catch(err) {
        let action = await vscode.window.showErrorMessage(`Errors in settings: ${err.message}`, "Show Logs");
        if ("Show Logs" === action) {
            log.showPanel();
        }
        return new Map<string, Job>();
    }
}

async function checkIfRunning() {
    for (let jenkins of Jenkins.hosts.values()) {
        for (let build of jenkins.builds) {
            if (build.running) {
                let answer = await vscode.window.showErrorMessage(`${build.description} is already running`, "Stop");
                if (answer === "Stop") {
                    build.stop();
                    // TODO:  race condition between actual stop and start of next job
                    // once this is fixed, this can return false and auto-start next job
                    return true;
                }
                return true;
            }
        }
    }
    return false;
}

async function runPipelineScriptOnDefault(textEditor: vscode.TextEditor) {
    if (await checkIfRunning()) {
        return;
    }

    let jobs = await getJobs();

    let defaultJob = [...jobs.values()].find(job => job.isDefault) || (jobs.values.length === 1 && jobs.values().next().value);

    if (!defaultJob) {
        return;
    }

    runPipelineScriptOnJob(textEditor, defaultJob);
}

async function runPipelineScriptOn(textEditor: vscode.TextEditor) {
    if (await checkIfRunning()) {
        return;
    }

    let jobs = [...(await getJobs()).values()];

    if (jobs.length === 1) {
        runPipelineScriptOnDefault(textEditor);
        return;
    }

    let friendlyNames = jobs.map(job => `${job.friendlyName}`);

    let picked = await vscode.window.showQuickPick(friendlyNames, {placeHolder: "Pick job to launch script on"});

    if (!picked) {
        return;
    }

    let jobToUse = jobs[friendlyNames.indexOf(picked)];

    runPipelineScriptOnJob(textEditor, jobToUse);
}

function forgetCachedPasswords() {
    cachedPasswords.clear();
}

function showPipelineLog() {
    outputChannel.show(true);
}

function stopPipelineRun() {
    for (let jenkins of Jenkins.hosts.values()) {
        for (let build of jenkins.builds) {
            build.stop();
        }
    }
}

const textEditorCommands = [
    runPipelineScriptOn,
    runPipelineScriptOnDefault,
];

const commands = [
    forgetCachedPasswords,
    showPipelineLog,
    stopPipelineRun,
];

export default function registerCommands(context: vscode.ExtensionContext) {
    for (let cmd of textEditorCommands) {
        context.subscriptions.push(vscode.commands.registerTextEditorCommand(cmd.name, cmd));
    }

    for (let cmd of commands) {
        context.subscriptions.push(vscode.commands.registerCommand(cmd.name, cmd));
    }
}