function python_suggestions() {
    return [
        // Python built-in functions
        {
            label: 'print',
            insertText: 'print(${1:value})',
            documentation: 'print(value, ..., sep=\' \', end=\'\\n\', file=sys.stdout, flush=False)\n\nPrints the values to a stream, or to sys.stdout by default.',
            detail: 'Built-in function',
        },
        {
            label: 'len',
            insertText: 'len(${1:obj})',
            documentation: 'Return the number of items in a container.',
            detail: 'Built-in function',
        },
        {
            label: 'range',
            insertText: 'range(${1:stop})',
            documentation: 'range(stop) -> range object\nrange(start, stop[, step]) -> range object',
            detail: 'Built-in class',
        },
        {
            label: 'type',
            insertText: 'type(${1:object})',
            documentation: 'type(object_or_name, bases, dict)\ntype(object) -> the object\'s type',
            detail: 'Built-in class',
        },
        {
            label: 'str',
            insertText: 'str(${1:object})',
            documentation: 'str(object=\'\') -> str\nstr(bytes_or_buffer[, encoding[, errors]]) -> str',
            detail: 'Built-in class',
        },
        {
            label: 'int',
            insertText: 'int(${1:x})',
            documentation: 'int([x]) -> integer\nint(x, base=10) -> integer',
            detail: 'Built-in class',
        },
        {
            label: 'float',
            insertText: 'float(${1:x})',
            documentation: 'float([x]) -> floating point number\nConvert a string or number to a floating point number, if possible.',
            detail: 'Built-in class',
        },
        {
            label: 'list',
            insertText: 'list(${1:iterable})',
            documentation: 'list([iterable]) -> new list initialized from iterable\'s items',
            detail: 'Built-in class',
        },
        {
            label: 'dict',
            insertText: 'dict(${1:kwargs})',
            documentation: 'dict() -> new empty dictionary\ndict(mapping) -> new dictionary initialized from a mapping object\'s\n    (key, value) pairs',
            detail: 'Built-in class',
        },
        // Python Keywords and Snippets
        {
            label: 'def',
            insertText: 'def ${1:function_name}(${2:args}):\n\t${3:pass}',
            documentation: 'Define a function',
            detail: 'Keyword snippet',
        },
        {
            label: 'class',
            insertText: 'class ${1:ClassName}:\n\tdef __init__(self):\n\t\t${2:pass}',
            documentation: 'Define a class',
            detail: 'Keyword snippet',
        },
        {
            label: 'if',
            insertText: 'if ${1:condition}:\n\t${2:pass}',
            documentation: 'If statement',
            detail: 'Keyword snippet',
        },
        {
            label: 'for',
            insertText: 'for ${1:item} in ${2:iterable}:\n\t${3:pass}',
            documentation: 'For loop',
            detail: 'Keyword snippet',
        },
        {
            label: 'while',
            insertText: 'while ${1:condition}:\n\t${2:pass}',
            documentation: 'While loop',
            detail: 'Keyword snippet',
        },
        {
            label: 'import',
            insertText: 'import ${1:module}',
            documentation: 'Import a module',
            detail: 'Keyword snippet',
        },
        {
            label: 'try',
            insertText: 'try:\n\t${1:pass}\nexcept ${2:Exception} as e:\n\t${3:print(e)}',
            documentation: 'Try-except block for error handling',
            detail: 'Keyword snippet',
        }
    ]
}