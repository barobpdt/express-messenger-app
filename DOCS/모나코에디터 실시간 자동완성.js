pip install pipwin
pipwin install pyaudio

pip install aiortc pyaudio websockets

통화걸기
python python/voice_client.py --username userA --call userB
수신대기
python python/voice_client.py --username userB --server ws://192.168.x.x:8081

🔧 동작 구조
서버 수정 없음: 기존 targetUser 기반 DM 방식 그대로 이용
WebRTC P2P: aiortc가 SDP/ICE를 교환 후 직접 P2P로 음성 전송
마이크 → MicrophoneTrack → aiortc → 상대 PC → 스피커 흐름

> call userB      # 통화 걸기
> hangup          # 통화 끊기
> quit            # 프로그램 종료


/*
모나코 에디터에서 자동완성(Suggestions) 추천 항목을 고정된 텍스트가 아니라 "실시간으로(동적으로)" 변경하거나 추가하려면, 

provideCompletionItems 함수가 에디터에서 타이핑할 때마다 매번 새로 호출된다는 점을 이용하시면 됩니다.

즉, 프로바이더를 매번 지우고 다시 등록할 필요 없이, 외부에 배열(Array) 변수를 하나 두고 거기에 힌트를 push() 방식으로 추가해두면, 에디터가 자동완성을 띄울 때마다 언제든지 최신 내용이 반영되게 됩니다!

실시간 동적 추가 방법 (예제 코드)
- registerCompletionItemProvider는 최초 한 번만 선언합니다.
- provideCompletionItems 내부에 하드코딩된 배열 대신, 외부 변수로 선언된 배열을 읽어와서 리턴(return { suggestions: 외부배열 }) 하도록 구현합니다.
- 이후 언제든지 자바스크립트 내에서 외부 배열에 push()하거나 안의 데이터를 삭제해주면 에디터의 추천 팝업에 실시간으로 반영됩니다!
*/

<script>
	var require = { paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' } };
</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs/loader.min.js"></script>
<script src="	"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs/editor/editor.main.js"></script>

<script src="./js/python_editor.js"></script>


// 1. 실시간으로 관리할 전역(또는 상위 스코프) 동적 배열 생성
let dynamicSuggestions = [];

// 2. 초기 1회만 Provider 등록 (기존 코드와 동일)
var completionProvider = monaco.languages.registerCompletionItemProvider('python', {
    provideCompletionItems: function(model, position) {
        var word = model.getWordUntilPosition(position);
        var range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
        };

        // 기본 제공할 고정 힌트들
        var baseSuggestions = [
            {
                label: 'print',
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: 'print(${1:value})',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: 'Built-in function',
                range: range
            }
        ];

        // 🔥 핵심: 기존 고정 힌트에 외부 배열(dynamicSuggestions)의 아이템들을 합쳐서 리턴합니다.
        // 이때 동적 힌트들에도 현재 타이핑 중인 줄의 `range` 값을 덮어씌워 줍니다.
        var finalSuggestions = baseSuggestions.concat(
             dynamicSuggestions.map(item => ({ ...item, range: range }))
        );

        return { suggestions: finalSuggestions };
    }
});

/* ----------------------------------------------------
   3. 런타임 중에 원하는 타이밍에 새로운 힌트 추가 가능!
---------------------------------------------------- */
function addCustomFunctionSnippet(funcName, description) {
    dynamicSuggestions.push({
        label: funcName,
        kind: monaco.languages.CompletionItemKind.Function, // (메서드, 키워드, 변수 등 종류 선택 가능)
        insertText: funcName + '(${1:args})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: description,
        detail: '실시간 추가된 커스텀 함수'
    });
}

// (예시) 파일이 로드된 후 5초 뒤에 새로운 자동완성을 쥐도새도 모르게 추가해 봅니다.
setTimeout(() => {
    addCustomFunctionSnippet("pandas_read_csv", "Pandas의 CSV 읽기 메서드입니다.");
    console.log("새로운 Snippet이 실시간으로 추가되었습니다! 에디터에 pan...을 쳐보세요.");
}, 5000);
