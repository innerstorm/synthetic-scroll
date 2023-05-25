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
      this.offsetTopBlocker;

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
      // on touchend
      window.addEventListener("touchend",  (ev) => this.onTouchEnd(ev));

      // broadcaster
      this.pageStatusReciever = new BroadcastChannel("page-scroll-status");
      this.syntheticScrollData = new BroadcastChannel("syntetic-scroll-data");

      this.blockerData = new BroadcastChannel("blocker-data");

       //
      this.blockerData.addEventListener("message", (ev) => {
        this.extraPageHeight = ev.data.extraPageHeight;
        this.offsetTopBlocker = ev.data.offsetTopBlocker;
      });
    }

    // Returns a function, that, as long as it continues to be invoked, will not
    // be triggered. The function will be called after it stops being called for
    // N milliseconds. If `immediate` is passed, trigger the function on the
    // leading edge, instead of the trailing.
    debounce(func, wait, immediate) {
      var timeout;
      return function() {
        var context = this, args = arguments;
        var later = function() {
          timeout = null;
          if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
      };
    };

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
        this.updateAllByMousePosition(ev);
      }
    }

    // document: onTouchStart
    onTouchStart(ev) {
      this.oldPageTouchPos = ev.touches[0].clientY;
    }
    
    // document: onTouchEnd
    onTouchEnd(ev) {
      window.removeEventListener("touchmove", (ev) => this.onTouchMove(ev));
    }

    // document: onTouchMove
    onTouchMove(event) {
      this.getNewData(event);
    }

    // Calculate delta depending on event:
    // wheel - deltaY
    // mousemove when scrollbar is pressed - diference between new and old ratio of clientY in scrollBox applied to heigth of the document + extraPageHeigth (the heigth of cards animation)
    // touchmove - difference between old touches[0].clientY and new touches[0].clientY
    calculateDelta(ev) {
      let delta;

      if (ev.type === 'wheel' ) { 
        delta = ev.deltaY;
      } else if (ev.type === 'touchmove') {
        this.newPageTouchPos = ev.touches[0].clientY; 
        delta =  this.scrollTouchStep * (this.oldPageTouchPos - this.newPageTouchPos);
        this.oldPageTouchPos = this.newPageTouchPos;
      } else {  
        delta = this.getNewPageScrollPos(ev);
      }

      return delta;
    }

    async getNewData(ev) {
        ev.preventDefault();
        
        // delta needs to be calculated by deltaY on wheel or by the mouse movement or touch
        let delta = this.calculateDelta(ev);

        try {
           this.blockedStatus = await this.waitForData(ev, delta);
        } catch (error) {
            console.error("Error occurred:", error);
        }

        // the page is not blocked
        if (this.blockedStatus !== 1) {
            // define new page scroll position by wheel delta
            // and a multiplier for better control off scrollspeed
            this.pageScrollPos += this.scrollStep * delta;

            // stop at the top if somehow on earth the position becomes negative (sic!)
            if (this.pageScrollPos < 0) {
                this.pageScrollPos = 0;
            }

            // also dont let the value get bigger than it shoud
            if (this.pageScrollPos > this.getMaxPageScrollPos(ev.type)) {
                this.pageScrollPos = this.getMaxPageScrollPos(ev.type);
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

            // update scrollbar according new page scroll position
            this.updateScrollBarPosition(this.pageScrollPos);
        }        
    }


    // wait for the broadcast communication
    waitForData(ev, delta) {
      return new Promise((resolve, reject) => {
        this.syntheticScrollData.postMessage({
          evType: ev.type,
          deltaY: Math.round(delta),
          scrollTop: this.pageScrollPos
        });

        // when somebody sends a "BLOCK/DEBLOCK PAGE" message,
        // we update our blocked state
        // broadcasters
        // reciever
        // this.pageStatusReciever = new BroadcastChannel("page-scroll-status");
        
        let newStatus;
        this.pageStatusReciever.addEventListener("message", (ev) => {
          newStatus = ev.data.blockedStatus;    
          resolve(newStatus);  
        }, {once: true});

        setTimeout(function() {
          if (!newStatus) {
            // show notification that evt has not been fired
            reject('no status');   
          }
        }, 200);
      });
    }

    getNewPageScrollPos(ev) {
        return Math.round(this.getScrollRatio(ev) * this.getMaxPageScrollPos(ev.type));
    }

    // calculate scrolling ratio depending on event 
    // on mouse movement we calculate ratio
    getScrollRatio(ev) {
        let ratio = 0;
        this.newClientY = ev.clientY;

        if (ev.type === 'mousemove' || ev.type === 'click') {
            ratio = (this.newClientY - this.oldClientY) / scrollBox.offsetHeight;
        } 

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
      if (posPx > this.scrollBox.offsetHeight - this.scrollBarHeight)
        posPx = this.scrollBox.offsetHeight - this.scrollBarHeight;
      if (posPx < 0)
        posPx = 0;

      this.scrollBar.style.top = `${posPx}px`;
    }
  
    // the max scroll position is body height - one page height
    getMaxPageScrollPos(evType = '') {
      return evType === 'mousemove' ?  document.body.scrollHeight - window.innerHeight + this.extraPageHeight : document.body.scrollHeight - window.innerHeight;
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
  