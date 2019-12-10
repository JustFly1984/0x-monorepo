import { ContractMethodDocs, DocumentedItem, SolidityDocs } from './sol_doc';

export interface MarkdownOpts {
    urlPrefix: string;
}

/**
 * Convert JSON docs to markdown.
 */
export function generateMarkdownFromDocs(docs: SolidityDocs, opts: Partial<MarkdownOpts> = {}): string {
    const lines = [
        ...generateTocContent(docs),
    ];
    for (const contractName of Object.keys(docs.contracts)) {
        lines.push(...generateContractsContent(contractName, docs, opts));
    }
    return lines.join('\n');
}

function generateTocContent(docs: SolidityDocs): string[] {
    return [];
}

function generateContractsContent(
    name: string,
    docs: SolidityDocs,
    opts: Partial<MarkdownOpts>,
): string[] {
    const contract = docs.contracts[name];
    const enums = [];
    const sortedEnums = Object.entries(contract.enums)
        .sort(([a], [b]) => a.localeCompare(b));
    for (const [enumName, enumDocs] of sortedEnums) {
        enums.push([
            `### ${toCode(enumName)}`,
            enumDocs.doc,
            '',
            toSourceAttributionLink(enumDocs, opts),
            '',
            `***Members***`,
            ...createTableContent(
                ['Name', 'Value', 'Description'],
                Object.entries(enumDocs.values).map(([n, d]) => [
                    toSourceLink(toCode(n), d, opts), toCode(d.value), d.doc,
                ]),
            ),
        ]);
    }
    const structSections = [];
    const sortedStructs = Object.entries(contract.structs)
        .sort(([a], [b]) => a.localeCompare(b));
    for (const [structName, structDocs] of sortedStructs) {
        structSections.push([
            `### ${toCode(structName)}`,
            structDocs.doc,
            '',
            toSourceAttributionLink(structDocs, opts),
            '',
            `***Fields***`,
            ...createTableContent(
                ['Name', 'Type', 'Description'],
                Object.entries(structDocs.fields).map(([n, d]) => [
                    toSourceLink(toCode(n), d, opts), toCode(d.type), d.doc,
                ]),
            ),
        ]);
    }
    const eventSections = [];
    const sortedEvents = contract.events
        .sort((a, b) => a.name.localeCompare(b.name));
    for (const event of sortedEvents) {
        eventSections.push([
            `### ${toCode(event.name)}`,
            event.doc,
            '',
            toSourceAttributionLink(event, opts),
            '',
            `***Parameters***`,
            ...createTableContent(
                ['Name', 'Type', 'Indexed', 'Description'],
                Object.entries(event.parameters).map(([n, d]) => [
                    toSourceLink(toCode(n), d, opts), toCode(d.type), toCode(d.indexed), d.doc,
                ]),
            ),
        ]);
    }
    const methodSections = [];
    const sortedMethods = contract.methods
        .sort((a, b) => a.name.localeCompare(b.name));
    for (const method of sortedMethods) {
        methodSections.push([
            method.kind === 'constructor' ?
                `### ${toCode('constructor')}` :
                `### ${toCode(method.name)}`,
            method.doc,
            '',
            `• ${toCode(getMethodSignature(method))}`,
            '',
            toSourceAttributionLink(method, opts),
            '',
            ...(Object.keys(method.parameters).length !== 0 ?
                [
                    `***Parameters***`,
                    ...createTableContent(
                        ['Name', 'Type', 'Description'],
                        Object.entries(method.parameters).map(([n, d]) => [
                            toSourceLink(toCode(n), d, opts), toCode(d.type), d.doc,
                        ]),
                    ),
                ] : []
            ),
            ...(Object.keys(method.returns).length !== 0 ?
                [
                    `***Returns***`,
                    ...createTableContent(
                        ['Name', 'Type', 'Description'],
                        Object.entries(method.returns).map(([n, d]) => [
                            toSourceLink(toCode(n), d, opts), toCode(d.type), d.doc,
                        ]),
                    ),
                ] : []
            ),
        ]);
    }
    return [
        `# ${contract.kind} ${toCode(name)}`,
        ...(enums.length > 0 ? [
            '## Enums',
            ...joinSections(enums),
        ] : []),
        ...(structSections.length > 0 ? [
            '## Structs',
            ...joinSections(structSections),
        ] : []),
        ...(eventSections.length > 0 ? [
            '## Events',
            ...joinSections(eventSections),
        ] : []),
        ...(methodSections.length > 0 ? [
            '## Methods',
            ...joinSections(methodSections),
        ] : []),
    ];
}

interface Stringable {
    toString(): string;
}

function joinSections(sections: string[][]): string[] {
    if (sections.length === 0) {
        return [];
    }
    const joined: string[] = [];
    for (const s of sections) {
        joined.push(...s, '---');
    }
    return joined.slice(0, joined.length - 1);
}

function toCode(v: Stringable | boolean): string {
    if (typeof(v) === 'boolean') {
        return `\`${v ? true : false}\``;
    }
    return `\`${v}\``;
}

function toSourceLink(text: string, doc: DocumentedItem, opts: Partial<MarkdownOpts>): string {
    return `[${text}](${toSourceURL(doc.file, doc.line, opts.urlPrefix)})`;
}

function toSourceAttributionLink(doc: DocumentedItem, opts: Partial<MarkdownOpts>): string {
    return `&nbsp; *Defined in ${toSourceLink(`${doc.file}:${doc.line}`, doc, opts)}*`;
}

function toSourceURL(file: string, line: number, prefix?: string): string {
    if (file.startsWith('/')) {
        return `${file}#L${line}`;
    }
    const _prefix = !prefix || prefix.endsWith('/') ? (prefix || '') : `${prefix}/`;
    return `${_prefix}${file}#L${line}`;
}

function getMethodSignature(method: ContractMethodDocs): string {
    const args = Object.entries(method.parameters).map(([name, param]) => {
        return /^\d+$/.test(name) ? param.type : `${param.type} ${name}`;
    });
    const returns = Object.entries(method.returns).map(([name, param]) => {
        return /^\d+$/.test(name) ? param.type : `${param.type} ${name}`;
    });
    const _returns = returns.length !== 0 ? `: (${returns.join(', ')})` : '';
    return `${method.name}(${args.join(', ')})${_returns}`;
}

function createTableContent(headers: string[], rows: Stringable[][]): string[] {
    const lines = [
        headers.join(' | '),
        headers.map(h => h.replace(/./g, '-')).join(' | '),
        ...rows.map(r => r.join(' | ')),
    ].map(line => `| ${line} |`);
    return ['', ...lines, ''];
}