const GAP = 10;
const TOP_DISTANCE = 40;

class Card {
  constructor(cardElement, index, translation) {
    this.cardStatus = 0;
    this.cardElement = cardElement;
    this.translation = translation;
    this.index = index;
    this.initialTranslation = 0;
    this.finalTranslation = 0;
  }

  setStatus(status) {
    this.cardStatus = status;
  }

  getStatus() {
    return this.cardStatus;
  }

  move(value) {
    this.cardElement.style.transform = `translateY(${value}px)`;
  }

  setTranslation(value) {
    this.translation = value;
  }

  getTranslation() {
    return this.translation;
  }

  setInitialTranslation(value) {
    this.initialTranslation = value;

    this.move(this.initialTranslation);
  }

  getInitialTranslation() {
    return this.initialTranslation;
  }

  setFinalTranslation(value) {
    this.finalTranslation = value;
  }

  getFinalTranslation() {
    return this.finalTranslation;
  }
}

class Deck {
  constructor(id) {
    this.id = id;
    // 0 - before deck animation, 1 - animation deck, 2 - after life
    this.deckGlobalStatus = 0;
    this.totalCardsHeight = 0;
    this.animationLength;
    this.containerNode = document.getElementById(id);
    this.offsetTop = 0;
    this.cardElements = this.containerNode.querySelectorAll(".card");
    // Array of card objects
    this.cards = [];
    // The total amount of scrolling during deck animation
    this.animationInternalScroll = 0;
    // Second card is the first to move (index = 1)
    this.currentMovingCardIndex = 1;
    // Create cards objects
    if (this.cardElements.length) {
      this.cardElements.forEach((card, index) => {
        this.cards[index] = new Card(card, index, this.options);
        this.setInitialCardTranslations(index, this.cards[index]);
        this.setFinalTranslations(index);
      });

      this.setTotalCardsHeight();
    }

    this.mouseButtonPressed = false;

    // for dispatch
    // window.addEventListener("pageMovement", (ev) => {
    //     console.log('on CUSTOM EVENT', ev.detail.deltaY);
    //     this.onEvent(ev)
    // });

    this.animationDataSender = new BroadcastChannel("blocker-data");
    this.syntheticScrollData = new BroadcastChannel("syntetic-scroll-data");
    this.pageStatusSender = new BroadcastChannel("page-scroll-status");

    this.syntheticScrollData.onmessage = (ev) => {
        console.log('3. broadcast wait ev data:: ', ev.data);
        this.onEvent(ev.data);
        
        if (ev.data.scrollTop < this.offsetTop) {
            this.setGlobalStatus(0);
        } else if (ev.data.scrollTop > this.offsetTop + this.animationLength) {
            this.setGlobalStatus(2);
        }
      // another version with dispatch
      //window.dispatchEvent(new CustomEvent('pageMovement', { detail: ev.data }));
    };
    

    window.onload = (ev) => {
        this.setAnimationDataAndSendIt();
    }

    window.onresize = (ev) => {
        this.setAnimationDataAndSendIt();
    } 
  }

  setTotalCardsHeight() {
    this.totalCardsHeight = 0;
    this.cardElements.forEach((card) => {
        this.totalCardsHeight += card.offsetHeight;
    });
  }

  setOffsetDeck() {
    this.offsetTop = this.containerNode.getBoundingClientRect().top + document.documentElement.scrollTop;
  }

  setAnimationDataAndSendIt() {
    this.setTotalCardsHeight();
    this.setOffsetDeck();

    this.animationLength = this.totalCardsHeight - (TOP_DISTANCE + GAP) * (this.cards.length - 1);

    this.animationDataSender.postMessage({extraPageHeight: this.animationLength, offsetTopBlocker: this.offsetTop});
  }

  // Calculate final translation value - when all cards are closed
  setFinalTranslations(index) {
    let finalTranslation = 0;
    for (let i = 0; i < index; i++) {
      finalTranslation += this.cards[i].cardElement.offsetHeight;
    }
    finalTranslation += index * (GAP - TOP_DISTANCE);

    // Set final translation on card
    this.cards[index].setFinalTranslation(finalTranslation);
  }

  // Calculate initial translation value - before animation starts (only first card is open)
  setInitialCardTranslations(index, card) {
    if (index === 0) card.setTranslation(0);
    else if (index === 1) card.setTranslation(-GAP * 2);
    else {
      card.setTranslation(this.calculateCardTranslation(index));
    }

    // Set initial translation value for card
    card.setInitialTranslation(card.translation);
  }

  calculateCardTranslation(index) {
    return (
      TOP_DISTANCE +
      this.cards[index - 1].translation -
      this.cards[index - 1].cardElement.offsetHeight
    );
  }

  setGlobalStatus(globalStatus) {
    // document.body.setAttribute("blocked", globalStatus);
    if (this.deckGlobalStatus !== globalStatus) {
        this.deckGlobalStatus = globalStatus;
    }

    console.log('4. Send status:: ', this.deckGlobalStatus);
    // broadcast status
    this.pageStatusSender.postMessage({blockedStatus: this.deckGlobalStatus, blockerElement: this.id});
  }

  getGlobalStatus() {
    return this.deckGlobalStatus;
  }

  onEvent(ev) {
    this.updateDeckStatus(ev);
  }

  updateDeckStatus(ev) {
    const scrollTop = ev.scrollTop;
    
    this.updateGlobalStatus(scrollTop);
    this.deckAnimation(ev);
  }

  deckAnimation(ev) {
    if (this.deckGlobalStatus === 1) {
        const scrollDistance = ev.deltaY;
        this.animationInternalScroll += scrollDistance;

        if (this.internalScrollingDown(scrollDistance)) {
        this.animateCardsScrollDown(this.currentMovingCardIndex, scrollDistance);
        } else if (this.internalScrollingUp(scrollDistance)) {
        this.animateCardsScrollUp(this.currentMovingCardIndex, scrollDistance);
        } else {
            console.log('STATUS SHOULD CHANGE!');
            if (scrollDistance > 0) {
            // animation is done, we scroll down
            this.setGlobalStatus(2);
    
            // index is last acrd
            this.currentMovingCardIndex = this.cards.length - 1;
    
            // set internal scroll to total animation height
            this.animationInternalScroll = this.animationLength;
    
            } else if (scrollDistance < 0) {
            this.setGlobalStatus(0);
            this.currentMovingCardIndex = 1;
            this.animationInternalScroll = 0;
            }
        }
    }
  }

  internalScrollingUp(scrollDistance) {
    console.log('UP this.animationInternalScroll:: ', this.animationInternalScroll);
    console.log('UP this.animationLength:: ', this.animationLength);
    return (
      scrollDistance < 0 &&
      this.animationInternalScroll >= 0
    );
  }

  internalScrollingDown(scrollDistance) {
      console.log('DOWN this.animationInternalScroll:: ', this.animationInternalScroll);
      console.log('DOWN this.animationLength:: ', this.animationLength);
    return (
      scrollDistance > 0 &&
      this.animationInternalScroll <= this.animationLength
    );
  }

  updateGlobalStatus(scrollTop) {
    console.log('00 this.deckGlobalStatus:: ', this.deckGlobalStatus);

    if (this.offsetTop < scrollTop && this.deckGlobalStatus === 0 || this.offsetTop > scrollTop && this.deckGlobalStatus === 2) {
      this.setGlobalStatus(1);
    } 
  }

  animateCardsScrollDown(index, scrollDistance) {
    let movingCard = this.cards[index];

    movingCard.setStatus(1);

    let newCardTranslation = scrollDistance - movingCard.getTranslation();

    // When scroll is down, stop card at finalTranslation and change card status
    if (newCardTranslation < movingCard.getFinalTranslation()) {
      movingCard.translation += -scrollDistance;
    } else {
      movingCard.translation = -movingCard.getFinalTranslation();
      movingCard.setStatus(2);

      //Set current moving card to the next one
      if (index < this.cards.length - 1) {
        this.currentMovingCardIndex = index + 1;
      }
    }
    movingCard.move(movingCard.translation);
  }

  animateCardsScrollUp(index, scrollDistance) {
    let movingCard = this.cards[index];

    //When scroll is up, stop card at initialTranslations and change animation status
    let newCardTranslation = movingCard.translation - scrollDistance;

    if (newCardTranslation < movingCard.getInitialTranslation()) {
      movingCard.translation += -scrollDistance;
    } else {
      movingCard.translation = movingCard.getInitialTranslation();
      movingCard.setStatus(0);


      //Set current moving card to the next one
      if (index > 0) {
        this.currentMovingCardIndex = index - 1;
      }
    }
    movingCard.move(movingCard.translation);
  }
}

//Initialise deck
const deck = new Deck("deck");
