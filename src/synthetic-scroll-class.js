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
      this.offsetTopBlocker = 400;
  
      // variation for scroll speed
      // pageScrollPos += scrollStep * wheelDeltaY;
      this.scrollStep = 1;
  
      // absolute pixel postion of the scrollBar
      this.scrollBarPosition = 0;
  
      // pixel height of the scrollbar
      this.scrollBarHeight = 0;
  
      // exact px amount of scroll offset of the page
      this.pageScrollPos = 0;
      this.newPageScrollPos = 0;
      this.oldPageScrollPos = 0;
  
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
      window.addEventListener("mousemove", (ev) => this.onMouseMove(ev));

      // on mouse down
      this.scrollBar.addEventListener("mousedown", (ev) => this.onMouseDown(ev));
  
      // on mouse up
      window.addEventListener("mouseup", (ev) => this.onMouseUp(ev));
  
      // click on scroll box
      this.scrollBox.addEventListener("click", (ev) => this.onScrollBoxClick(ev));

       
      // broadcaster
      this.syntheticScrollData = new BroadcastChannel("syntetic-scroll-data");

      this.animationLengthReceiver = new BroadcastChannel("animation-length");

       //
       this.animationLengthReceiver.addEventListener("message", (ev) => {
        this.extraPageHeight = ev.data;
      });
    }
  
    // events
    // ------
    // window: on page load we init the size/pos of the scrollbar
    // and set a listener for blocked status broadcast
    onPageLoad() {
      this.scrollRestore();
      this.updateScrollBarSize();
      this.updateScrollBarPosition(this.pageScrollPos);
    }

    // window: on window resize we update
    // the scrollbar's size and position
    onPageResize() {
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
        if (this.isScrollBarPressed ) {
            this.getNewData(ev);
            // if( this.blockedStatus !== 1 ) {
            //     this.updateAllByMousePosition(ev);
            // }
        }
    }
  
    // scrollbar: scrollbar is pressed
    onMouseDown() {
      this.isScrollBarPressed = true;
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
        this.updateAllByMousePosition(ev);
      }
    }

    async getNewData(ev) {
        ev.preventDefault();
        
        // delta needs to be calculated by deltaY on wheel or by the mouse movement
        let delta;

        if (ev.type === 'wheel') { 
            console.log('1. Delta:: ', ev.deltaY);
            delta = ev.deltaY;
        } else {        
            this.newPageScrollPos = this.getNewPageScrollPos(ev);
            delta = this.newPageScrollPos - this.oldPageScrollPos;
            delta = (this.blockedStatus !== 1) ? delta : 2 * delta;
            this.oldPageScrollPos = this.newPageScrollPos;
        }

        try {
            this.blockedStatus = await this.waitForData(ev, delta);
            console.log('after wait data status ', this.blockedStatus);
        } catch (error) {
            console.error("Error occurred:", error);
        }

        console.log('this.blockedStatus = ', this.blockedStatus);

        // the page is not blocked
        if (this.blockedStatus !== 1) {
            // define new page scroll position by wheel delta
            // and a multiplier for better control off scrollspeed
            this.pageScrollPos += this.scrollStep * delta;
            console.log('5. SCROLLBAR MOVED - this.pageScrollPos', this.pageScrollPos, ' - delta ', delta);

            // stop at the top if somehow on earth the position becomes negative (sic!)
            if (this.pageScrollPos < 0) {
                this.pageScrollPos = 0;
            }

            // also dont let the value get bigger than it shoud
            if (this.pageScrollPos > this.getMaxPageScrollPos()) {
                this.pageScrollPos = this.getMaxPageScrollPos();
            }

            // const offsetTopBlocker = this.blockerElement.getBoundingClientRect().top + document.documentElement.scrollTop;
            if (this.blockedStatus === 0 && this.offsetTopBlocker < this.pageScrollPos) {
                // finally scroll to the new position
                window.scrollTo({ top: this.offsetTopBlocker });
            } else if (this.blockedStatus === 2 && this.offsetTopBlocker > this.pageScrollPos) {
                // finally scroll to the new position
                window.scrollTo({ top: this.offsetTopBlocker })
            } else {
                window.scrollTo({ top: this.pageScrollPos });
            }

            

            // update scrollbar according new psge scroll position
            this.updateScrollBarPosition(this.pageScrollPos);
        }        
        
        return delta;
    }


    // wait for the broadcast communication
    waitForData(ev, delta) {
        console.log('2. Wait data:: ');

        const statusPromised1 = new Promise((resolve, reject) => {
            console.log('2.1 timestamp befor post message', Date.now()); 
            this.syntheticScrollData.postMessage({
                evType: ev.type,
                deltaY: Math.round(delta),
                scrollTop: this.pageScrollPos
            });
    
            this.pageStatusReciever = new BroadcastChannel("page-scroll-status");
            // when somebody sends a "BLOCK/DEBLOCK PAGE" message,
            // we update our blocked state
            // broadcasters
            // reciever
            this.pageStatusReciever.addEventListener("message", (ev) => {
                console.log('!!!!!!!!!!!!!!!!!!!!!!!! ev.data.blockedStatus :: ', ev.data.blockedStatus);
                this.blockedStatus = ev.data.blockedStatus;
                this.offsetTopBlocker = 400;
                this.blockerElement = document.getElementById(ev.data.blockerElement);

                resolve(this.blockedStatus);
            });//, {once: true});

            // resolve(this.blockedStatus);
        });
        
        statusPromised1.then((value) => {
            console.log(value);
            // Expected output: "foo"
        });

        // statusPromised1.reject((value) => {
        //     console.log(value);
        //     // Expected output: "foo"
        // });
        
        console.log('!! statusPromised1:: ', statusPromised1);

        // const promiseA = new Promise((resolve, reject) => {
        //     resolve(777);
        //   });

        return statusPromised1;
    }

    getNewPageScrollPos(ev) {
        return Math.round(this.getScrollRatio(ev) * this.getMaxPageScrollPos());
    }

    // calculate scrolling ratio depending on event 
    // on mouse movement we calculate ratio
    getScrollRatio(ev) {
        let ratio;

        if (ev.type === 'mousemove' || ev.type === 'click') {
            ratio = ev.clientY / scrollBox.offsetHeight;
        } else {
            ratio = this.pageScrollPos / this.getMaxPageScrollPos();
        }
 
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
      // update scrollbar position px
      this.scrollBarPosition = Math.round(
        (newPosPx / this.getMaxPageScrollPos()) *
        (this.scrollBox.offsetHeight - this.scrollBarHeight)
      );
  
      // set scrollbar element's new position
      this.applyScrollBarPosition(this.scrollBarPosition);
    }
  
    // the major update function that updates all and all
    updateAllByMousePosition(ev) {
        // set page scroll position to the newly calculated pos
        window.scrollTo(0, this.pageScrollPos);
    
        // update scrollbar position
        if (this.blockedStatus !== 1) {
            const scrollOffsetPercent = this.getScrollRatio(ev);
            this.scrollBarPosition = Math.round(
            scrollOffsetPercent *
                (this.scrollBox.offsetHeight - this.scrollBarHeight)
            );
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

    //Scroll retsoration on page load
    scrollRestore() {
      // This prevents the page from scrolling down to where it was previously.
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
      }
      
      window.scrollTo(0,0);
    }
  }
  
  // BRING IT ALIVE!!!
  const syntheticScroll = new SyntheticScroll(document.body);
  