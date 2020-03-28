import * as util from "util";
import * as xml2js from "xml2js";

const parseXmlString = util.promisify(xml2js.parseString) as any as (xml: string) => any;

export const SHORT_NAME = "envinject";

/**
 * Creates the portion of a job's XML config for the envinject job property
 * Allows injecting environment variables into the job
 * Requires envinject plugin to be installed on Jenkins
 */
export async function createXmlConfig(envinjectVersion: string, properties: any) {
    let propertiesConfig = Object.entries(properties).map(([k,v]) => `${k}=${v}`).join("\n");

    let xmlNode = await parseXmlString(`
    <EnvInjectJobProperty plugin="envinject@${envinjectVersion}">
      <info>
        <propertiesContent>${propertiesConfig}</propertiesContent>
      </info>
      <on>true</on>
      <keepJenkinsSystemVariables>true</keepJenkinsSystemVariables>
      <keepBuildVariables>true</keepBuildVariables>
      <overrideBuildParameters>false</overrideBuildParameters>
  </EnvInjectJobProperty>`);

  return xmlNode;
}