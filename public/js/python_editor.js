$(document).ready(function () {
    const $runBtn = $("#run-btn");
    const $console = $("#console-output");
    
    // Register custom Python autocomplete provider before creating editor
    monaco.languages.registerCompletionItemProvider('python', {
        provideCompletionItems: function(model, position) {
            // Find current word
            var word = model.getWordUntilPosition(position);
            var range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            var suggestions = [
                // Python built-in functions
                {
                    label: 'print',
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'print(${1:value})',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'print(value, ..., sep=\' \', end=\'\\n\', file=sys.stdout, flush=False)\n\nPrints the values to a stream, or to sys.stdout by default.',
                    detail: 'Built-in function',
                    range: range
                },
                {
                    label: 'len',
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'len(${1:obj})',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Return the number of items in a container.',
                    detail: 'Built-in function',
                    range: range
                },
                {
                    label: 'range',
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'range(${1:stop})',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'range(stop) -> range object\nrange(start, stop[, step]) -> range object',
                    detail: 'Built-in class',
                    range: range
                },
                {
                    label: 'type',
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'type(${1:object})',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'type(object_or_name, bases, dict)\ntype(object) -> the object\'s type',
                    detail: 'Built-in class',
                    range: range
                },
                {
                    label: 'str',
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'str(${1:object})',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'str(object=\'\') -> str\nstr(bytes_or_buffer[, encoding[, errors]]) -> str',
                    detail: 'Built-in class',
                    range: range
                },
                {
                    label: 'int',
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'int(${1:x})',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'int([x]) -> integer\nint(x, base=10) -> integer',
                    detail: 'Built-in class',
                    range: range
                },
                {
                    label: 'float',
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'float(${1:x})',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'float([x]) -> floating point number\nConvert a string or number to a floating point number, if possible.',
                    detail: 'Built-in class',
                    range: range
                },
                {
                    label: 'list',
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'list(${1:iterable})',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'list([iterable]) -> new list initialized from iterable\'s items',
                    detail: 'Built-in class',
                    range: range
                },
                {
                    label: 'dict',
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'dict(${1:kwargs})',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'dict() -> new empty dictionary\ndict(mapping) -> new dictionary initialized from a mapping object\'s\n    (key, value) pairs',
                    detail: 'Built-in class',
                    range: range
                },
                // Python Keywords and Snippets
                {
                    label: 'def',
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: 'def ${1:function_name}(${2:args}):\n\t${3:pass}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Define a function',
                    detail: 'Keyword snippet',
                    range: range
                },
                {
                    label: 'class',
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: 'class ${1:ClassName}:\n\tdef __init__(self):\n\t\t${2:pass}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Define a class',
                    detail: 'Keyword snippet',
                    range: range
                },
                {
                    label: 'if',
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: 'if ${1:condition}:\n\t${2:pass}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'If statement',
                    detail: 'Keyword snippet',
                    range: range
                },
                {
                    label: 'for',
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: 'for ${1:item} in ${2:iterable}:\n\t${3:pass}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'For loop',
                    detail: 'Keyword snippet',
                    range: range
                },
                {
                    label: 'while',
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: 'while ${1:condition}:\n\t${2:pass}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'While loop',
                    detail: 'Keyword snippet',
                    range: range
                },
                {
                    label: 'import',
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: 'import ${1:module}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Import a module',
                    detail: 'Keyword snippet',
                    range: range
                },
                {
                    label: 'try',
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: 'try:\n\t${1:pass}\nexcept ${2:Exception} as e:\n\t${3:print(e)}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Try-except block for error handling',
                    detail: 'Keyword snippet',
                    range: range
                }
            ];

            return { suggestions: suggestions };
        }
    });

    // Create Monaco Editor
    window.editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: [
            '# 파이썬 코드를 작성해보세요!',
            '# 아래에 print, def, class 등을 입력하면 강력한 자동완성 힌트가 나타납니다.',
            '',
            'def greet(name):',
            '    print(f"Hello, {name}! This is Monaco Editor.")',
            '',
            'greet("Python Developer")',
            ''
        ].join('\n'),
        language: 'python',
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 16,
        fontFamily: 'Consolas, "Courier New", monospace',
        minimap: { enabled: false },
        suggestOnTriggerCharacters: true,
        quickSuggestions: true,
        snippetSuggestions: 'top',
        wordWrap: 'on'
    });

    // Handle "Run" button click (Mock execution)
    $runBtn.on('click', function() {
        const code = window.editor.getValue();
        $console.show().html('<span style="color:#64748b;">// 시스템 알림: 실시간 파이썬 서버 연결 전입니다. 시뮬레이션된 결과만 출력됩니다.</span><br><br>');
        
        let output = "<span style='color:#38bdf8;'>>>> 파이썬 코드 실행 시작...</span>\n";
        
        if (code.includes('print')) {
            output += "✅ 'print' 문이 확인되었습니다.\n";
            if(code.includes('greet("Python Developer")')) {
                output += "<span style='color:white; font-weight:bold;'>Hello, Python Developer! This is Monaco Editor.</span>\n";
            }
        } else {
            output += "동작을 확인할 수 없는 코드이거나 출력이 없습니다.\n";
        }
        
        $console.append(output.replace(/\n/g, '<br>'));
        
        // Resize editor to make room for console
        $('#editor-container').css('height', 'calc(100vh - 300px)');
    });
});
