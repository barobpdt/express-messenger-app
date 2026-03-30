// PPT Presentation Logic
$(document).ready(function () {
    const $uploadInput = $("#ppt-upload");
    const $resultDiv = $("#pptx-result");
    const $placeholder = $("#placeholder");
    const $fsBtn = $("#fs-btn");
    $('#app').addClass('show');
    const $btnPrev = $("#btn-prev");
    const $btnNext = $("#btn-next");
    const $pinfo = $("#pinfo");

    // Hide native pptxjs navigation overlays but keep functionality
    $("<style>")
        .prop("type", "text/css")
        .html("\
            .ppt-nav, .nv-dir-btn-l, .nv-dir-btn-r, .slide-number, .slide-info { display: none !important; opacity: 0 !important; visibility: hidden !important; }\
        ")
        .appendTo("head");

    // Use PPTXjs built-in file input handling
    $resultDiv.pptxToHtml({
        pptxFileUrl: "",
        fileInputId: "ppt-upload",
        slideMode: true,
        keyBoardShortCut: true,
        mediaProcess: true,
        jsZipV2: true,
        slideModeConfig: {
            first: 1,
            nav: false,
            navTxtColor: "white",
            navNextTxt: "&#8250;",
            navPrevTxt: "&#8249;",
            showPlayPauseBtn: false,
            keyBoardShortCut: true,
            showSlideNum: true,
            showTotalSlideNum: true,
            autoSlide: false,
            randomAutoSlide: false,
            loop: false,
            background: "black",
            transition: "default",
            transitionTime: 1
        }
    });

    // Hide placeholder on upload
    $uploadInput.on("change", function (event) {
        if (event.target.files && event.target.files.length > 0) {
            $placeholder.hide();
            $btnPrev.prop("disabled", false);
            $btnNext.prop("disabled", false);

            // Poll for generated slides to update info
            let attempts = 0;
            const checkSlides = setInterval(() => {
                attempts++;
                const currentTxt = $(".slide-number").text() || $(".pageNum").text() || "";
                if (currentTxt || $(".slide").length > 0) { // slides are loaded
                    updateCustomNavInfo();
                    if (attempts > 50) clearInterval(checkSlides);
                }
            }, 500);
        }
    });

    // Custom navigation button clicks
    $btnPrev.on("click", function () {
        // Trigger left arrow key
        const e = $.Event("keydown", { keyCode: 37 });
        $(window).trigger(e);
        $(document).trigger(e);
        setTimeout(updateCustomNavInfo, 100);
    });

    $btnNext.on("click", function () {
        // Trigger right arrow key
        const e = $.Event("keydown", { keyCode: 39 });
        $(window).trigger(e);
        $(document).trigger(e);
        setTimeout(updateCustomNavInfo, 100);
    });

    // Also update on manual key presses by user
    $(document).on("keydown", function (e) {
        if (e.keyCode === 37 || e.keyCode === 39) {
            setTimeout(updateCustomNavInfo, 100);
        }
    });

    function updateCustomNavInfo() {
        // pptxjs might set class active or visible to current slide
        const totalSlides = $(".slide").length || 0;
        let pinfoText = "0 / 0";
        if (totalSlides > 0) {
            // Find active slide (usually the one visible or with active class)
            // divs2slides usually manages display logic or z-index
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
            if (file.name.endsWith('.pptx')) {
                // mock event to trigger change
                const dt = new DataTransfer();
                dt.items.add(file);
                $uploadInput[0].files = dt.files;
                $uploadInput.trigger('change');
            } else {
                alert(".pptx 파일만 지원합니다.");
            }
        }
    });
});
