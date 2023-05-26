const DELTA_MIN = 10;
const DELTA_MAX = 100;
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

    // offset in px for the blocker element 
    this.offsetTopBlocker;

    // size of the blocking state in px
    this.extraPageHeight;

    this.freeScrolling = true;

    this.startY = 0; // Variable to store initial touch position
    this.scrollTop = 0; // Variable to store initial scroll position

    // variation for scroll speed
    // pageScrollPos += scrollStep * wheelDeltaY;
    this.scrollStep = 1;
    this.scrollTouchStep = 5;

    // absolute pixel postion of the scrollBar
    this.scrollBarPosition = 0;

    // pixel height of the scrollbar
    this.scrollBarHeight = 0;

    // exact px amount of scroll offset of the page
    this.pageScrollPos = 0;
    this.oldClientY = 0;
    this.newClientY = 0;


    this.newPageTouchPos = 0;
    this.oldPageTouchPos = 0;

    // event handlers
    // --------------
    // init on page load
    window.addEventListener("load", (ev) => this.onPageLoad(ev));

    // on page resize
    window.addEventListener("resize", (ev) => this.onPageResize(ev));

    // on scrolling with wheel
    document.addEventListener("wheel", (ev) => this.onMouseWheel(ev), {
      passive: false
    });

    // on mouse move
    window.addEventListener("mousemove", (ev) => this.onMouseMove(ev), {
      passive: false
    });

    // on mouse down
    this.scrollBar.addEventListener("mousedown", (ev) => this.onMouseDown(ev));

    // on mouse up
    window.addEventListener("mouseup", (ev) => this.onMouseUp(ev));

    // click on scroll box
    this.scrollBox.addEventListener("click", (ev) => this.onScrollBoxClick(ev));

    // on touchmove
    window.addEventListener("touchmove", (ev) => this.onTouchMove(ev), {
      passive: false
    });
    // on touchstart
    window.addEventListener("touchstart", (ev) => this.onTouchStart(ev));

    // broadcaster
    this.pageStatusReciever = new BroadcastChannel("page-scroll-status");
    this.syntheticScrollData = new BroadcastChannel("syntetic-scroll-data");

    this.blockerData = new BroadcastChannel("blocker-data");

    //
    this.blockerData.addEventListener("message", (ev) => {
      this.extraPageHeight = ev.data.extraPageHeight;
      this.offsetTopBlocker = ev.data.offsetTopBlocker;
      this.freeScrolling = ev.data.freeScrolling;
    });
  }

  // events
  // ------
  // window: on page load we init the size/pos of the scrollbar
  // and set a listener for blocked status broadcast
  onPageLoad(ev) {
    this.scrollRestore();
    this.updateScrollBarSize();
    this.updateScrollBarPosition(this.pageScrollPos);
  }

  // window: on window resize we update
  // the scrollbar's size and position
  onPageResize(ev) {
    this.updateScrollBarSize();
    this.updateScrollBarPosition(this.pageScrollPos);
  }

  // document: on mouse wheel event
  onMouseWheel(ev) {
    this.getNewData(ev);
  }

  // window: while holding the scrollbar we move the mouse,
  // update page scroll
  // update scrollbar pos
  onMouseMove(ev) {
    // move the mouse on the scrollbar while the page is NOT blocked
    // so we replicate classic scrolling behavior
    if (this.isScrollBarPressed) {
      this.getNewData(ev);
    }
  }

  // scrollbar: scrollbar is pressed
  onMouseDown(ev) {
    this.isScrollBarPressed = true;
    this.oldClientY = ev.clientY;
  }

  // window: scrollbar is not pressed anymore
  onMouseUp() {
    this.isScrollBarPressed = false;
  }

  // scrollBox: clicking anywhere on scrollbox updates the scrollbar's position
  // and page's scroll position
  onScrollBoxClick(ev) {
    if (ev.target === this.scrollBox) {
      this.getNewData(ev);
    }
  }

  // document: onTouchStart
  onTouchStart(ev) {
    this.oldPageTouchPos = ev.touches[0].clientY;
  }

  // document: onTouchMove
  onTouchMove(event) {
    this.getNewData(event);
  }

  async getNewData(ev) {
    ev.preventDefault();

    // delta needs to be calculated by deltaY on wheel or by the mouse movement or touch
    let delta = this.calculateDelta(ev);

    try {
      this.blockedStatus = await this.waitForData(ev, delta);
    } catch (error) {
      console.log("Error occurred:", error);
    }

    if (ev.type === 'click')
      this.updatePageScrollPosOnClick(delta, ev);
    else
      this.updatePageScrollPos(delta, ev);
  }

  // Calculate delta depending on event:
  // wheel - deltaY
  // mousemove when scrollbar is pressed - diference between new and old ratio of clientY in scrollBox applied to heigth of the document + extraPageHeigth (the heigth of cards animation)
  // touchmove - difference between old touches[0].clientY and new touches[0].clientY
  calculateDelta(ev) {
    let delta;

    delta = this.adjustDeltaBasedOnEventType(ev, delta);

    if (ev.type !== 'click')
      delta = this.adjustMinMaxDelta(delta);

    return Math.round(delta);
  }

  adjustDeltaBasedOnEventType(ev, delta) {
    const expr = ev.type;
    switch (expr) {
      case 'wheel':
        delta = ev.deltaY;
        break;
      case 'touchmove':
        this.newPageTouchPos = ev.touches[0].clientY;
        delta = this.scrollTouchStep * (this.oldPageTouchPos - this.newPageTouchPos);
        this.oldPageTouchPos = this.newPageTouchPos;
        break;
      default:
        delta = this.getDeltaByMouseEvent(ev);
    }
    return delta;
  }

  adjustMinMaxDelta(delta) {
    const deltaSign = Math.sign(delta);

    if (Math.abs(delta) < DELTA_MIN)
      delta = deltaSign * DELTA_MIN;

    if (Math.abs(delta) > DELTA_MAX)
      delta = deltaSign * DELTA_MAX;

    return delta;
  }

  // wait for the broadcast communication
  waitForData(ev, delta) {
    return new Promise((resolve, reject) => {
      this.sendMessage(ev, delta);

      // when somebody sends a "BLOCK/DEBLOCK PAGE" message,
      // we update our blocked state
      // broadcasters
      // reciever
      let message;
      message = this.receiveMessage(message, resolve);

      setTimeout(function () {
        if (!message) {
          // show notification that evt has not been fired
          reject('no status');
        }
      }, 20);
    });
  }

  sendMessage(ev, delta) {
    this.syntheticScrollData.postMessage({
      evType: ev.type,
      deltaY: delta,
      scrollTop: this.pageScrollPos
    });
  }

  receiveMessage(newStatus, resolve) {
    this.pageStatusReciever.addEventListener("message", (ev) => {
      newStatus = ev.data.blockedStatus;
      resolve(newStatus);
    }, { once: true });
    return newStatus;
  }

  updatePageScrollPosOnClick(delta, ev) {
    this.pageScrollPos += this.scrollStep * delta;

    let newPagePos = this.pageScrollPos;

    const insideAnimation = ( newPagePos > this.offsetTopBlocker) && ( newPagePos < this.offsetTopBlocker + this.extraPageHeight);
    // const notAboveAnimation = newPagePos > this.offsetTopBlocker;

    if (this.freeScrolling && insideAnimation) { //|| (!this.freeScrolling && notAboveAnimation)) {
      newPagePos = this.offsetTopBlocker;
      // this.freeScrolling = true;
    }
    
    window.scrollTo({ top: newPagePos });

    // update scrollbar according new page scroll position
    this.updateScrollBarPosition(newPagePos, ev.type);
  }

  updatePageScrollPos(delta, ev) {
    if (this.blockedStatus !== 1) {
      // define new page scroll position by wheel delta
      // and a multiplier for better control off scrollspeed
      this.pageScrollPos += this.scrollStep * delta;
      
      this.setMinMaxPageScrollPos(ev);

      this.syntheticScrolling();

      // update scrollbar according new page scroll position
      this.updateScrollBarPosition(this.pageScrollPos, ev.type);
    }
  }

  setMinMaxPageScrollPos(ev) {
    // stop at the top if somehow on earth the position becomes negative (sic!)
    if (this.pageScrollPos < 0) {
      this.pageScrollPos = 0;
    }  // also dont let the value get bigger than it shoud
    if (this.pageScrollPos > this.getMaxPageScrollPos(ev.type)) {
      this.pageScrollPos = this.getMaxPageScrollPos(ev.type);
    }
  }

  syntheticScrolling() {
    const aboveAnimation = this.blockedStatus === 0 && this.offsetTopBlocker < this.pageScrollPos;
    const belowAnimation = this.blockedStatus === 2 && this.offsetTopBlocker > this.pageScrollPos;
    if (aboveAnimation || belowAnimation)
      // finally scroll to the new position
      window.scrollTo({ top: this.offsetTopBlocker });
    else
      window.scrollTo({ top: this.pageScrollPos });
  }

  getDeltaByMouseEvent(ev) {
    return Math.round(this.getScrollRatio(ev) * this.getMaxPageScrollPos(ev.type));
  }

  getScrollBarPositionAtBlockerOffset() {
    return this.offsetTopBlocker / this.getMaxPageScrollPos() * scrollBox.offsetHeight;
  }

  // calculate scrolling ratio depending on event 
  // on mouse movement we calculate ratio
  getScrollRatio(ev) {
    let ratio = 0;

    this.newClientY = ev.clientY;
    if(ev.type === 'click' && this.freeScrolling)
      this.oldClientY = this.scrollBar.offsetTop;

    const checkMouseEvent = ev.type === 'mousemove' || ev.type === 'click';
    if (checkMouseEvent)
      ratio = (this.newClientY - this.oldClientY) / scrollBox.offsetHeight;

    this.oldClientY = this.newClientY;

    return ratio;
  }

  // updaters
  // --------
  // update scrollbar size by content and screen height ratio
  updateScrollBarSize() {
    // percent of window height to content height
    const barHeightPercent =
      (window.innerHeight / document.body.scrollHeight) * 100;
    // calculate the height of the bar by the content height
    this.scrollBarHeight = Math.round(
      (this.scrollBox.offsetHeight * barHeightPercent) / 100
    );
    // apply css for scrollbar height
    this.scrollBar.style.height = `${this.scrollBarHeight}px`;
  }

  // update scrollbar position
  updateScrollBarPosition(newPosPx) {
    const maxScrollBarPos = this.scrollBox.offsetHeight - this.scrollBarHeight;

    // update scrollbar position px
    this.scrollBarPosition = Math.round(
      (newPosPx / this.getMaxPageScrollPos()) *
      (maxScrollBarPos)
    );

    this.setMinMaxScrollBarPosition(maxScrollBarPos);

    // set scrollbar element's new position
    this.applyScrollBarPosition(this.scrollBarPosition);
  }

  setMinMaxScrollBarPosition(maxScrollBarPos) {
    if (this.scrollBarPosition > maxScrollBarPos)
      this.scrollBarPosition = maxScrollBarPos;
    if (this.scrollBarPosition < 0)
      this.scrollBarPosition = 0;
  }

  // helpers
  // -------
  // set css of the scrollbar pos
  applyScrollBarPosition(posPx) {
    this.scrollBar.style.top = `${posPx}px`;
  }

  // the max scroll position is body height - one page height
  getMaxPageScrollPos(evType = '') {
    return evType === 'mousemove' ? document.body.scrollHeight - window.innerHeight + this.extraPageHeight : document.body.scrollHeight - window.innerHeight;
  }

  //Scroll retsoration on page load
  scrollRestore() {
    // This prevents the page from scrolling down to where it was previously.
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    window.scrollTo(0, 0);
  }
}

// BRING IT ALIVE!!!
const syntheticScroll = new SyntheticScroll(document.body);
