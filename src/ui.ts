
import * as vscode from "vscode";
import * as log from "./log";
import Constants from "./constants";

export default class UI {
    private statusBarTimer: NodeJS.Timer|undefined;
    private readonly statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);

    public readonly jobOutputChannel = vscode.window.createOutputChannel(Constants.PLUGIN_FRIENDLY_NAME);

    public readonly jobDiagnostics = vscode.languages.createDiagnosticCollection(Constants.PLUGIN_FRIENDLY_NAME);

    public static readonly instance = new UI();

    private constructor() {
        this.statusBarIdle("");
    }

    public async showError(msg: string, actionText = "Show Logs", action = ()=>{log.showPanel();}) {
        let answer = await vscode.window.showErrorMessage(msg, actionText);
        if (actionText === answer) {
            action();
        }
    }

    public statusBarIdle(commandOnClick: string) {
        this.statusBar.command = commandOnClick;
        this.statusBar.text = Constants.STATUS_BAR_IDLE;
        this.statusBar.color = "white";
        this.statusBar.tooltip = "Launch Jenkins Job";
        this.statusBar.show();

        if (this.statusBarTimer) {
            clearInterval(this.statusBarTimer);
            this.statusBarTimer = undefined;
        }
    }

    public statusBarRunning(commandOnClick: string, description: string) {
        this.statusBar.command = commandOnClick;
        this.statusBar.text = Constants.STATUS_BAR_RUNNING("zap", description);
        this.statusBar.color = "white";
        this.statusBar.tooltip = "Show Log";
        this.statusBar.show();

        let tick = 1;
        this.statusBarTimer = setInterval(() => {
            this.statusBar.text = Constants.STATUS_BAR_RUNNING(tick % 2 ? "zap" : "file", description);
            tick++;
        }, 1000);
    }
}

