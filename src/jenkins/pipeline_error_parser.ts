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

const RE_GROOVY_ERRORS = [
    /*
    WorkflowScript: 9: expecting ''', found '\n' @ line 9, column 32.
                    echo '"$Person"
                                    ^
    */
    /^(?<path>[^:]+):(?<line>[^:]+):(?<message>[^@]+) @ line \d+, column (?<column>\d+)/,

    /*
    at WorkflowScript.run(WorkflowScript:2)
    */
    /.*WorkflowScript.run\((?<path>[^:]+):(?<line>\d+)\).*/,
];

export interface GroovyError {
    path: string;
    line: number;
    column?: number;
    message?: string;
}

export function parseGroovyErrors(text: string) {
    let errors: GroovyError[] = [];

    for (let line of text.split("\n")) {
        for (let re of RE_GROOVY_ERRORS) {
            let match = re.exec(line) as null|{groups: {path: string, line: string, column?: string, message?: string}};
            if (match !== null) {
                errors.push({
                    path: match.groups.path,
                    message: match.groups.message,
                    line: Number.parseInt(match.groups.line),
                    column: match.groups.column ? Number.parseInt(match.groups.column) : undefined,
                });
            }
        }
    }

    return errors;
}
