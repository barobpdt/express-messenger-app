import fetch from 'node-fetch';

async function testTodoAPI() {
    console.log("🚀 Testing Todo API...");

    // 1. Create Todo
    const createRes = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            title: "첫 번째 테스트 작업",
            description: "API를 통해 자동 생성된 테스트 업무입니다.",
            issueTrackerText: "TEST-001",
            remindAt: new Date(Date.now() + 86400000).toISOString() // 내일
        })
    });
    const todo = await createRes.json();
    console.log("✅ Created:", todo.title);

    // 2. Update Todo (Status Change -> should create history)
    const updateRes = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            status: "진행",
            note: "테스트 스크립트에 의해 '진행'으로 상태 변경됨"
        })
    });
    const updated = await updateRes.json();
    console.log("✅ Updated Status:", updated.status);

    // 3. Create another Todo and mark as '완료'
    const createRes2 = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            title: "엑셀 다운로드용 완료 건",
            description: "이 건은 엑셀에 나와야 함",
            issueTrackerText: "TEST-002"
        })
    });
    const todo2 = await createRes2.json();
    await fetch(`/api/todos/${todo2.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "완료", note: "바로 완료처리" })
    });
    console.log("✅ Created & Completed second todo");

    console.log("🎉 Test Data Injection Finished");
}

testTodoAPI();
