const GAP = 10;
const TOP_DISTANCE = 40;
const FREE_SCROLLING = true;

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
    this.cardsHeight = 0;
    this.animationLength;
    this.deckHeightOpen;
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


      this.setCardsHeight();
    }

    this.mouseButtonPressed = false;


    this.animationDataSender = new BroadcastChannel("blocker-data");
    this.syntheticScrollData = new BroadcastChannel("syntetic-scroll-data");
    this.pageStatusSender = new BroadcastChannel("page-scroll-status");

    this.syntheticScrollData.onmessage = (ev) => {
      this.onEvent(ev.data);
    };


    window.onload = (ev) => {
      this.setAnimationDataAndSendIt();
    }

    window.onresize = (ev) => {
      this.setAnimationDataAndSendIt();
    }
  }

  setCardsHeight() {
    this.cardsHeight = 0;
    for (let i = 0; i < this.cardElements.length - 1; i++) {
      this.cardsHeight += this.cardElements[i].offsetHeight;
    }
  }

  setOffsetDeck() {
    this.offsetTop = this.containerNode.getBoundingClientRect().top + document.documentElement.scrollTop;
  }

  setAnimationDataAndSendIt() {
    this.setCardsHeight();
    this.setOffsetDeck();

    this.animationLength = this.cardsHeight - (TOP_DISTANCE + GAP) * (this.cards.length - 1);
    // first card heigth - Gap (card overlaping) + last card heigth + number rest cards * TOP Distance
    this.deckHeightOpen = this.cardElements[0].offsetHeight - GAP + this.cardElements[this.cards.length - 1].offsetHeight + TOP_DISTANCE * (this.cards.length - 2);

    this.animationDataSender.postMessage({ 
      extraPageHeight: this.animationLength, 
      deckHeightOpen: this.deckHeightOpen, 
      offsetTopBlocker: this.offsetTop, 
      freeScrolling: FREE_SCROLLING });
  }

  // Calculate final translation value - when all cards are closed
  setFinalTranslations(index) {
    let finalTranslation = 0;
    for (let i = 0; i < index; i++) {
      finalTranslation += this.cards[i].cardElement.offsetHeight;
    }
    finalTranslation += index * (-GAP - TOP_DISTANCE);

    // Set final translation on card
    this.cards[index].setFinalTranslation(finalTranslation);
  }

  // Calculate initial translation value - before animation starts (only first card is open)
  setInitialCardTranslations(index, card) {
    this.setCardPosition(index, card);
    // Set initial translation value for card
    card.setInitialTranslation(card.translation);
  }

  setCardPosition(index, card) {
    const expr = index;
    switch (expr) {
      case 0:
        card.setTranslation(0);
        break;
      case 1:
        card.setTranslation(-GAP * 2);
        break;
      default:
        card.setTranslation(this.calculateCardTranslation(index));
    }
  }

  calculateCardTranslation(index) {
    return (
      TOP_DISTANCE +
      this.cards[index - 1].translation -
      this.cards[index - 1].cardElement.offsetHeight
    );
  }

  setGlobalStatus(globalStatus) {
    if (this.deckGlobalStatus !== globalStatus) {
      this.deckGlobalStatus = globalStatus;
      this.applyCardsPosByStatus(globalStatus);
    }

    // broadcast status
    this.pageStatusSender.postMessage({ blockedStatus: this.deckGlobalStatus });
  }

  applyCardsPosByStatus(status) {
    if (status !== 1) {
      this.cards.forEach((card) => {
        if (status === 2) {
          card.setTranslation(-card.getFinalTranslation())
        }
        else if (status === 0) {
          card.setTranslation(card.getInitialTranslation())
        }

        card.move(card.translation);
      });
    }
  }

  getGlobalStatus() {
    return this.deckGlobalStatus;
  }

  onEvent(ev) {
    if (ev.evType === 'click' && FREE_SCROLLING) {
      this.updateGlobalStatusOnClick(ev);
    }
    else {
      this.updateGlobalStatus(ev);
      this.deckAnimation(ev);
    }
  }

  deckAnimation(ev) {
    if (this.deckGlobalStatus !== 1)
      return;

    const scrollDistance = ev.deltaY;
    this.animationInternalScroll += scrollDistance;

    if (this.internalScrollingDown(scrollDistance)) {
      this.animateCardsScrollDown(this.currentMovingCardIndex, scrollDistance);
    }
    else if (this.internalScrollingUp(scrollDistance)) {
      this.animateCardsScrollUp(this.currentMovingCardIndex, scrollDistance);
    }
    else if (scrollDistance !== 0) {
      const deckStatus = scrollDistance > 0 ? 2 : 0;
      this.updateAnimationParams(deckStatus);
      this.setGlobalStatus(deckStatus);
    }
  }

  updateAnimationParams(status) {
    this.currentMovingCardIndex = (status === 2) ? (this.cards.length - 1) : 1;
    this.animationInternalScroll = (status === 2) ? this.animationLength : 0;
  }

  internalScrollingUp(scrollDistance) {
    return (
      scrollDistance <= 0 &&
      this.animationInternalScroll >= 0
    );
  }

  internalScrollingDown(scrollDistance) {
    return (
      scrollDistance >= 0 &&
      this.animationInternalScroll <= this.animationLength
    );
  }

  updateGlobalStatusOnClick(ev) {
    const scrollPosition = ev.scrollTop + ev.deltaY;
    const animationEndPosition = this.offsetTop + this.animationLength;

    if (scrollPosition > animationEndPosition) {
      this.setGlobalStatus(2);
      this.updateAnimationParams(2);
    } else if (scrollPosition < this.offsetTop) {
      this.setGlobalStatus(0);
      this.updateAnimationParams(0);
    } else {
      this.setGlobalStatus(1);
      this.updateAnimationParams(0);
      this.applyCardsPosByStatus(0);
    }
  }

  updateGlobalStatus(ev) {
    const comingFromAbove = this.deckGlobalStatus === 0 && this.offsetTop < ev.scrollTop;
    const comingFromBelow = this.deckGlobalStatus === 2 && this.offsetTop > ev.scrollTop;
    if (comingFromAbove || comingFromBelow) {
      this.setGlobalStatus(1);
    } else if (this.deckGlobalStatus !== 1) {
      this.setGlobalStatus(this.offsetTop > ev.scrollTop ? 0 : 2);
    }
  }

  animateCardsScrollDown(index, scrollDistance) {
    this.setGlobalStatus(1);
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
    this.setGlobalStatus(1);
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
