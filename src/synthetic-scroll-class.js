class SyntheticScroll {
    constructor(element) {

        // properties
        // ----------

        // scrollBox element
        this.scrollBox = element.querySelector("#scrollBox");

        // scrollbar element
        this.scrollBar = element.querySelector("#scrollBar");

        // we have a mousedown on our scrollbar
        this.isScrollBarPressed = false;

        // status for scrollstop (from Deck terminology)
        // 0 - not stopped yet, 
        // 1 - stopped
        // 2 - after stopped
        this.blockedStatus = 0;

        // variatior for scroll speed
        // pageScrollPos += scrollStep * wheelDeltaY;
        this.scrollStep = 24;

        // absolute pixel postion of the scrollBar
        this.scrollBarPosition = 0;

        // pixel height of the scrollbar
        this.scrollBarHeight = 0;

        // exact px amount of scroll offset of the page
        this.pageScrollPos = 0;


        // event handlers
        // --------------
        // on scrolling with wheel
        document.addEventListener("wheel", (ev) => this.onMouseWheel(ev), { passive: false });

        // on mouse move
        window.addEventListener("mousemove", (ev) => this.onMouseMove(ev));

        // on mouse up
        window.addEventListener("mouseup", (ev) => this.onMouseUp(ev));

        // init on page load
        window.addEventListener("load", (ev) => this.onPageLoad(ev));

        // on page resize
        window.addEventListener("resize", (ev) => this.onPageResize(ev));

        // click on scroll box
        this.scrollBox.addEventListener("click", (ev) => this.onScrollBoxClick(ev));

        // on mouse down 
        this.scrollBar.addEventListener("mousedown", (ev) => this.onMouseDown(ev));

        // broadcasters
        // reciever
        this.pageStatusReciever = new BroadcastChannel("page-status");

        // broadcaster
        this.syntheticScrollData = new BroadcastChannel("scroll-data");

    }


    // events
    // ------
    // window: on page load we init the size/pos of the scrollbar
    // and set a listener for blocked status broadcast
    onPageLoad() {
        this.updateScrollBarSize();
        this.updateScrollBarPosition(this.pageScrollPos);

        // when somebody sends a "BLOCK/DEBLOCK PAGE" message, 
        // we update our blocked state
        this.pageStatusReciever.onmessage = (ev) => {
            this.blockedStatus = ev.data;
        }
    }

    // window: on window resize we update 
    // the scrollbar's size and position
    onPageResize() {
        this.updateScrollBarSize();
        this.updateScrollBarPosition(this.pageScrollPos);
    }

    // scrollbar: scrollbar is pressed
    onMouseDown() {
        this.isScrollBarPressed = true;
    }

    // window: scrollbar is not pressed anymore
    onMouseUp() {
        this.isScrollBarPressed = false;
    }

    // window: while holding the scrollbar we move the mouse, 
    // update page scroll 
    // update scrollbar pos
    onMouseMove(ev) {
        // move the mouse on the scrollbar while the page is NOT blocked
        // so we replicate classic scrolling behavior
        if (this.isScrollBarPressed && this.blockedStatus !== 1) {
            this.updateAllByMousePosition(ev);
        }

        // when scrolling with scrollbar 
        // we update scrolling data programatically all the time
        if (this.isScrollBarPressed) {
            // TODO:
        }
    }

    // scrollBox: clicking anywhere on scrollbox updates the scrollbar's position
    // and page's scroll position
    onScrollBoxClick(ev) {
        if (ev.target === this.scrollBox) {
            this.updateAllByMousePosition(ev);
        }
    }

    // document: on mouse wheel event
    onMouseWheel(ev) {
        ev.preventDefault();

        // the page is not blocked
        if (this.blockedStatus !== 1) {
            const deltaY = Math.sign(ev.deltaY);

            // define new page scroll position by wheel delta 
            // and a multiplier for better control off scrollspeed
            this.pageScrollPos += this.scrollStep * deltaY;

            // stop at the top if somehow on earth the position becomes negative (sic!)
            if (this.pageScrollPos < 0) {
                this.pageScrollPos = 0;
            }

            // also dont let the value get bigger than it shoud
            if (this.pageScrollPos > this.getMaxPageScrollPos()) {
                this.pageScrollPos = this.getMaxPageScrollPos();
            }

            // finally scroll to the new position
            window.scrollTo({ top: this.pageScrollPos });

            // update scrollbar according new psge scroll position
            this.updateScrollBarPosition(this.pageScrollPos);
        }

        // broadcast message to world to hear that
        // we have a new scroll position
        this.syntheticScrollData.postMessage({
            type: "wheel",
            deltaY: Math.round(ev.deltaY)
        });
    }

    // updaters
    // --------
    // update scrollbar size by content and screen height ratio
    updateScrollBarSize() {

        // percent of window height to content height
        const barHeightPercent =
            (window.innerHeight / document.body.scrollHeight) * 100;
        // calculate the height of the bar by the content height
        this.scrollBarHeight = Math.round((this.scrollBox.offsetHeight * barHeightPercent) / 100);
        // apply css for scrollbar height
        this.scrollBar.style.height = `${this.scrollBarHeight}px`;
    }


    // update scrollbar position
    updateScrollBarPosition(newPosPx) {
        // update scrollbar position px
        this.scrollBarPosition = Math.round(
            (newPosPx / this.getMaxPageScrollPos()) *
            (this.scrollBox.offsetHeight - this.scrollBarHeight)
        );

        // set scrollbar element's new position
        this.applyScrollBarPosition(this.scrollBarPosition)
    }


    // the major update function that updates all and all
    updateAllByMousePosition(ev) {
        const scrollOffsetPercent = ev.clientY / this.scrollBox.offsetHeight;

        this.pageScrollPos = Math.round(scrollOffsetPercent * this.getMaxPageScrollPos());

        // set page scroll position to the newly calculated pos
        window.scrollTo(0, this.pageScrollPos);

        // update scrollbar position
        if (this.blockedStatus !== 1) {
            this.scrollBarPosition = Math.round(scrollOffsetPercent * (this.scrollBox.offsetHeight - this.scrollBarHeight));
            // place the scrollbar according to the click on the scrollbox
            this.applyScrollBarPosition(this.scrollBarPosition);
        }
    }


    // helpers
    // -------
    // set css of the scrollbar pos
    applyScrollBarPosition(posPx) {
        this.scrollBar.style.top = `${posPx}px`;
    }

    // the max scroll position is body height - one page height
    getMaxPageScrollPos() {
        return document.body.scrollHeight - window.innerHeight;
    }
}

// BRING IT ALIVE!!!
const syntheticScroll = new SyntheticScroll(document.body);