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
import Constants from "./constants";

enum LogLevel {
    ERROR = "error",
    WARN = "warn",
    INFO = "info",
    DEBUG = "debug",
}

const outputChannel = vscode.window.createOutputChannel(`${Constants.PLUGIN_FRIENDLY_NAME} - Debug Log`);

export class Logger {
    constructor(private readonly tag: string) {

    }

    error(msg: string) {
        error(this.tag, msg);
    }

    warn(msg: string) {
        warn(this.tag, msg);
    }

    info(msg: string) {
        info(this.tag, msg);
    }

    debug(msg: string) {
        debug(this.tag, msg);
    }
}


function log(level: LogLevel, tag: string, msg: string) {
    const pad = (number: Number, to = 2) => {
        let asString = `${number}`;

        return `${"0".repeat(to > asString.length ? to - asString.length : 0)}${asString}`;
    };

    const now = new Date();

    const dateString = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    const timeString = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;

    outputChannel.appendLine(`[${dateString} ${timeString}] [${tag}] [${level}] ${msg}`);
}

export function error(tag: string, msg: string) {
    log(LogLevel.ERROR, tag, msg);
}

export function warn(tag: string, msg: string) {
    log(LogLevel.WARN, tag, msg);
}

export function info(tag: string, msg: string) {
    log(LogLevel.INFO, tag, msg);
}

export function debug(tag: string, msg: string) {
    log(LogLevel.DEBUG, tag, msg);
}

export function showPanel() {
    outputChannel.show(true);
}