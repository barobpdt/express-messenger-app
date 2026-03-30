// Document Presentation Logic
$(document).ready(function () {
    const $uploadInput = $("#ppt-upload");
    const $resultDiv = $("#pptx-result");
    const $docResult = $("#doc-result");
    const $docInner = $("#doc-result-inner");
    const $xlsResult = $("#xls-result");
    const $xlsInner = $("#xls-result-inner");
    const $htmlResult = $("#html-result");
    const $htmlFrame = $("#html-result-frame");
    const $placeholder = $("#placeholder");
    const $fsBtn = $("#fs-btn");
    $('#app').addClass('show');
    const $btnPrev = $("#btn-prev");
    const $btnNext = $("#btn-next");
    const $pinfo = $("#pinfo");
    const $modeToggle = $("#mode-toggle");

    // Feature buttons
    const $editBtn = $("#edit-mode-btn");
    const $saveBtn = $("#save-html-btn");

    // Global state
    let currentArrayBuffer = null;
    let currentHtmlContent = "";
    let currentFileType = null;
    let isSlideMode = true;
    let slideCheckInterval = null;
    let isEditing = false;

    // Hide native pptxjs navigation overlays but keep functionality
    $("<style>")
        .prop("type", "text/css")
        .html("\
            .ppt-nav, .nv-dir-btn-l, .nv-dir-btn-r, .slide-number, .slide-info { display: none !important; opacity: 0 !important; visibility: hidden !important; }\
        ")
        .appendTo("head");

    // File Input Event Handling
    $uploadInput.on("change", function (event) {
        if (!event.target.files || event.target.files.length === 0) return;
        const file = event.target.files[0];

        // Determine file type
        const name = file.name.toLowerCase();
        if (name.endsWith(".pptx")) currentFileType = "pptx";
        else if (name.endsWith(".docx")) currentFileType = "docx";
        else if (name.endsWith(".xlsx")) currentFileType = "xlsx";
        else if (name.endsWith(".html")) currentFileType = "html";
        else {
            alert(".pptx, .docx, .xlsx, .html 파일만 지원합니다.");
            return;
        }

        $placeholder.hide();

        const reader = new FileReader();
        if (currentFileType === "html") {
            reader.onload = function(e) {
                currentHtmlContent = e.target.result;
                renderDocument();
            };
            reader.readAsText(file);
        } else {
            reader.onload = function (e) {
                currentArrayBuffer = e.target.result;
                if (currentFileType === "pptx") {
                    if (window.currentPptxUrl) URL.revokeObjectURL(window.currentPptxUrl);
                    const blob = new Blob([currentArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
                    window.currentPptxUrl = URL.createObjectURL(blob);
                }
                renderDocument();
            };
            reader.readAsArrayBuffer(file);
        }
    });

    // Core Rendering Function
    function renderDocument() {
        if (!currentArrayBuffer && !currentHtmlContent) return;

        // Reset views
        $resultDiv.hide().empty();
        $docResult.hide(); $docInner.empty();
        $xlsResult.hide(); $xlsInner.empty();
        $htmlResult.hide(); $htmlFrame.attr("srcdoc", "");
        clearInterval(slideCheckInterval);
        $btnPrev.prop("disabled", true);
        $btnNext.prop("disabled", true);
        $pinfo.text("- / -");

        if (currentFileType === "pptx") {
            $resultDiv.show();
            if (isSlideMode) {
                $btnPrev.prop("disabled", false);
                $btnNext.prop("disabled", false);
                $modeToggle.text("↕ 스크롤 뷰");
            } else {
                $modeToggle.text("▤ 슬라이드 뷰");
            }

            // PPTXjs call using blob URL instead of binaryData
            $resultDiv.pptxToHtml({
                pptxFileUrl: window.currentPptxUrl,
                fileInputId: "",
                slideMode: isSlideMode,
                keyBoardShortCut: isSlideMode,
                mediaProcess: true,
                jsZipV2: true,
                slideModeConfig: {
                    first: 1,
                    nav: false,
                    navTxtColor: "white",
                    navNextTxt: "&#8250;",
                    navPrevTxt: "&#8249;",
                    showPlayPauseBtn: false,
                    keyBoardShortCut: isSlideMode,
                    showSlideNum: isSlideMode,
                    showTotalSlideNum: isSlideMode,
                    autoSlide: false,
                    randomAutoSlide: false,
                    loop: false,
                    background: "black",
                    transition: "default",
                    transitionTime: 1
                }
            });

            if (isSlideMode) {
                // Poll for generated slides to update info
                let attempts = 0;
                slideCheckInterval = setInterval(() => {
                    attempts++;
                    const currentTxt = $(".slide-number").text() || $(".pageNum").text() || "";
                    if (currentTxt || $(".slide").length > 0) {
                        updateCustomNavInfo();
                        if (attempts > 50) clearInterval(slideCheckInterval);
                    }
                }, 500);
            }

        } else if (currentFileType === "docx") {
            $docResult.show();
            $modeToggle.text("세로 뷰 고정");
            mammoth.convertToHtml({ arrayBuffer: currentArrayBuffer })
                .then(function (result) {
                    $docInner.html(result.value);
                })
                .catch(function (err) {
                    console.error("Word 변환 에러:", err);
                    $docInner.html("<p style='color:red;'>Word 문서를 불러오는 중 오류가 발생했습니다.</p>");
                });

        } else if (currentFileType === "xlsx") {
            $xlsResult.show();
            $modeToggle.text("세로 뷰 고정");

            try {
                const data = new Uint8Array(currentArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const htmlStr = XLSX.utils.sheet_to_html(worksheet);
                $xlsInner.html(htmlStr);
            } catch (err) {
                console.error("Excel 변환 에러:", err);
                $xlsInner.html("<p style='color:red;'>Excel 문서를 불러오는 중 오류가 발생했습니다.</p>");
            }
        } else if (currentFileType === "html") {
            $htmlResult.show();
            $modeToggle.text("세로 뷰 고정");
            $htmlFrame.attr("srcdoc", currentHtmlContent);
        }
    }

    // Toggle Button
    $modeToggle.on("click", function () {
        if (!currentFileType || currentFileType !== "pptx") return; // Toggle only applies to PPTX right now
        isSlideMode = !isSlideMode;
        renderDocument();
    });

    // Toggle Edit Mode
    $editBtn.on("click", function () {
        if (!currentArrayBuffer && !currentHtmlContent) return;
        isEditing = !isEditing;
        if (isEditing) {
            $editBtn.html("✏️ 편집 모드: <b>ON</b>");
            $("#pptx-result, #doc-result-inner, #xls-result-inner")
                .attr("contenteditable", "true")
                .css("outline", "2px dashed #4f46e5");
            
            // Also enable edit in iframe if html file
            if (currentFileType === "html") {
                const fDoc = $htmlFrame.get(0).contentDocument || $htmlFrame.get(0).contentWindow.document;
                $(fDoc).find("body").attr("contenteditable", "true").css("outline", "2px dashed #4f46e5");
            }

            $("<style id='edit-mode-style'>")
                .prop("type", "text/css")
                .html("[contenteditable='true'] * { user-select: text !important; cursor: text !important; pointer-events: auto !important; }")
                .appendTo("head");
        } else {
            $editBtn.html("✏️ 편집 모드: OFF");
            $("#pptx-result, #doc-result-inner, #xls-result-inner")
                .removeAttr("contenteditable")
                .css("outline", "none");
            
            if (currentFileType === "html") {
                const fDoc = $htmlFrame.get(0).contentDocument || $htmlFrame.get(0).contentWindow.document;
                $(fDoc).find("body").removeAttr("contenteditable").css("outline", "none");
            }

            $("#edit-mode-style").remove();
        }
    });

    // Capture all keydown events FIRST to prevent pptxjs from blocking space/enter/arrows
    document.addEventListener("keydown", function (e) {
        if (isEditing) {
            e.stopPropagation(); // Prevent pptxjs keyboard shortcuts from eating the key press
        }
    }, true);

    // Save as HTML
    $saveBtn.on("click", function () {
        if (!currentArrayBuffer && !currentHtmlContent) {
            alert("먼저 문서를 열어주세요!");
            return;
        }

        let fullHtml = "";

        if (currentFileType === "html") {
            // For HTML files, grab the entire document from iframe (or use modified srcdoc body)
            const fDoc = $htmlFrame.get(0).contentDocument || $htmlFrame.get(0).contentWindow.document;
            fullHtml = "<!DOCTYPE html>\n<html>\n" + $(fDoc).find("html").html() + "\n</html>";
        } else {
            let contentHtml = "";
            let extraStyles = "";

            if (currentFileType === "pptx") {
                contentHtml = $resultDiv.html();
                extraStyles = `
                    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/meshesha/PPTXjs@1.21.1/css/pptxjs.css">
                    <style> 
                        body { margin: 0; background: #e5e7eb; display:flex; justify-content:center; }
                        .slide { position:relative; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); background: white; }
                    </style>
                `;
            } else if (currentFileType === "docx") {
                contentHtml = `<div style="max-width:900px; margin:40px auto; padding:40px; background:white; font-family:sans-serif; color:black; box-shadow:0 0 10px rgba(0,0,0,0.1); line-height:1.6;">${$docInner.html()}</div>`;
                extraStyles = `<style>body { margin: 0; background: #e5e7eb; }</style>`;
            } else if (currentFileType === "xlsx") {
                contentHtml = `<div style="max-width:1200px; margin:40px auto; padding:40px; background:white; font-family:sans-serif; color:black; overflow:auto; box-shadow:0 0 10px rgba(0,0,0,0.1);">${$xlsInner.html()}</div>`;
                extraStyles = `<style>body { margin: 0; background: #e5e7eb; } table { border-collapse: collapse; width:100%; } th,td { border: 1px solid #ccc; padding: 8px; }</style>`;
            }

            fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>Saved Document</title>
    ${extraStyles}
</head>
<body>
    ${contentHtml}
</body>
</html>`;
        }

        const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `edited_${currentFileType}_document.html`;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    });

    // Custom navigation button clicks (only active in slide mode)
    $btnPrev.on("click", function () {
        if (!isSlideMode || currentFileType !== "pptx") return;
        const e = $.Event("keydown", { keyCode: 37 });
        $(window).trigger(e);
        $(document).trigger(e);
        setTimeout(updateCustomNavInfo, 100);
    });

    $btnNext.on("click", function () {
        if (!isSlideMode || currentFileType !== "pptx") return;
        const e = $.Event("keydown", { keyCode: 39 });
        $(window).trigger(e);
        $(document).trigger(e);
        setTimeout(updateCustomNavInfo, 100);
    });

    // Also update on manual key presses by user
    $(document).on("keydown", function (e) {
        if (isSlideMode && currentFileType === "pptx" && (e.keyCode === 37 || e.keyCode === 39)) {
            setTimeout(updateCustomNavInfo, 100);
        }
    });

    function updateCustomNavInfo() {
        if (!isSlideMode || currentFileType !== "pptx") return;
        const totalSlides = $(".slide").length || 0;
        let pinfoText = "0 / 0";
        if (totalSlides > 0) {
            let actIndex = 0;
            $(".slide").each(function (i) {
                if ($(this).css('display') !== 'none' && $(this).css('opacity') != '0') {
                    actIndex = i;
                }
            });
            pinfoText = (actIndex + 1) + " / " + totalSlides;
        }
        $pinfo.text(pinfoText);
    }

    // Fullscreen Event
    $fsBtn.on("click", function () {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    // Listen to fullscreen changes to apply styling
    $(document).on("fullscreenchange", function () {
        if (document.fullscreenElement) {
            $("body").addClass("fullscreen");
        } else {
            $("body").removeClass("fullscreen");
        }
    });

    // Drag and drop support
    const slideArea = document.getElementById("slide-area");
    slideArea.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.stopPropagation();
        slideArea.style.opacity = "0.7";
    });

    slideArea.addEventListener("dragleave", function (e) {
        e.preventDefault();
        e.stopPropagation();
        slideArea.style.opacity = "1";
    });

    slideArea.addEventListener("drop", function (e) {
        e.preventDefault();
        e.stopPropagation();
        slideArea.style.opacity = "1";

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            const name = file.name.toLowerCase();
            if (name.endsWith('.pptx') || name.endsWith('.docx') || name.endsWith('.xlsx') || name.endsWith('.html')) {
                // mock event to trigger change
                const dt = new DataTransfer();
                dt.items.add(file);
                $uploadInput[0].files = dt.files;
                $uploadInput.trigger('change');
            } else {
                alert(".pptx, .docx, .xlsx, .html 파일만 지원합니다.");
            }
        }
    });
});
