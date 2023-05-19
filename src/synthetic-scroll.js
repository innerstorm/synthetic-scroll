const bc = new BroadcastChannel("test_scroll");

const pageStatusReciever = new BroadcastChannel('page-status');
const syntheticScrollData = new BroadcastChannel('scroll-data');

// Set up variables

// absolute value of page scroll
let pageScrollPosition = 0;

// height of the scrollbar
let barHeight = 0;

let wheelEvent = false;

const content = document.body;
const scrollStep = 24; // Change this value to adjust scroll speed

// absolute position of the scrollbarPos in px
let scrollBarPosition = 0;

let isScrollBarPressed = false;

let blockedStatus = 0;
let newPageScrollPos = 0;

let oldPageScrollPos = 0;

const scrollBox = document.querySelector("#scrollBox");
const scrollBar = document.querySelector("#scrollBar");

// update size of the scrollbar
function updateScrollBarSize() {
    const barheightPercent =
        (window.innerHeight / document.body.scrollHeight) * 100;
    // calculate the height of the bar by the content height
    barHeight = Math.floor((scrollBox.offsetHeight * barheightPercent) / 100);
    scrollBar.style.height = `${barHeight}px`;
}

// update position of the scrollbar
function updateScrollBarPos(newPageScrollPos) {
    // calculate the position in px by scroll positions and such
    scrollBarPosition = Math.floor(
        (newPageScrollPos / (document.body.scrollHeight - window.innerHeight)) *
        (scrollBox.offsetHeight - barHeight)
    );
    scrollBar.style.top = `${scrollBarPosition}px`;
}

function updateAllByMousePosition(ev, status) {
    const scrolledRatio = ev.clientY / scrollBox.offsetHeight;
    newPageScrollPos = Math.round(
        scrolledRatio * (document.body.scrollHeight - window.innerHeight)
    );

    // set scroll position by clicked pos
    window.scrollTo(0, newPageScrollPos);

    if (status !== 1) {
        console.log('nu e unu', status);
        // TODO: encapsulate into updatescrollbarpos
        pageScrollPosition = newPageScrollPos;
        const newScrollPos = scrolledRatio * (scrollBox.offsetHeight - barHeight);
        scrollBar.style.top = `${newScrollPos}px`;
    }


}

function updateAllByMousePositionOnBlock(mouseY) {


}

// click on scrollbarPos
scrollBox.addEventListener("click", (ev) => {
    if (ev.target === scrollBox) {
        updateAllByMousePosition(ev);
    }
});

// moving while holding scrollbarPos
window.addEventListener("mousemove", (ev) => {
    if (isScrollBarPressed && blockedStatus !== 1) {
        // console.log("blocked status ", blockedStatus);
        updateAllByMousePosition(ev);
    }

    if (isScrollBarPressed) {
        // !!!!! wrong calculation method
        // delta needs to be calculated by the mouse movment while page is blocked
        const delta = newPageScrollPos - oldPageScrollPos;
        console.log('new ', newPageScrollPos, ' old ', oldPageScrollPos);
        syntheticScrollData.postMessage({
            evtype: ev.type,
            deltaY: Math.round(delta)
        });

        oldPageScrollPos = newPageScrollPos;
    }
});

// letting go
window.addEventListener("mouseup", (ev) => {
    isScrollBarPressed = false;
});

// grabbing scrollbarPos
scrollBar.addEventListener("mousedown", (ev) => {
    console.log("mouse down ", ev);
    isScrollBarPressed = true;
});

window.addEventListener("load", () => {
    updateScrollBarSize();
    updateScrollBarPos(pageScrollPosition);
});

window.addEventListener("resize", (e) => {
    updateScrollBarSize();
    updateScrollBarPos(pageScrollPosition);
});

// Add event listener for wheel event
document.addEventListener(
    "wheel",
    (e) => {
        e.preventDefault();

        if (blockedStatus !== 1) {
            // console.log("NU E BLOCAT");

            // Determine the direction of the wheel scroll
            const delta = Math.sign(e.deltaY);

            // Update the scroll position based on the scroll direction
            pageScrollPosition += scrollStep * delta;

            // Ensure scroll position stays within bounds
            if (pageScrollPosition < 0) {
                pageScrollPosition = 0;
            }
            if (pageScrollPosition > content.scrollHeight - window.innerHeight) {
                pageScrollPosition = content.scrollHeight - window.innerHeight;
            }

            // Set new scroll position
            window.scrollTo({
                top: pageScrollPosition
            });

            updateScrollBarPos(pageScrollPosition);
        }

        syntheticScrollData.postMessage({
            evtype: 'wheel',
            deltaY: Math.round(e.deltaY)
        });

    },
    { passive: false }
);

// Add event listener for scroll event
document.addEventListener("scroll", (ev) => { });

pageStatusReciever.onmessage = (ev) => {
    blockedStatus = ev.data;
    console.log('i recieved the data: ', ev.data);
}
