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
        this.containerNode = document.getElementById(id);
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
                this.totalCardsHeight += card.offsetHeight;
                this.cards[index] = new Card(card, index, this.options);
                this.setInitialCardTranslations(index, this.cards[index]);
                this.setFinalTranslations(index);
            });
        }

        this.mouseButtonPressed = false;

        // for dispatch
        // window.addEventListener("pageMovement", (ev) => {
        //     console.log('on CUSTOM EVENT', ev.detail.deltaY);
        //     this.onEvent(ev)
        // });

        this.syntheticScrollData = new BroadcastChannel('scroll-data');
        this.pageStatusSender = new BroadcastChannel('page-status');

        this.syntheticScrollData.onmessage = (ev) => {
            this.onEvent(ev.data)
            // another version with dispatch
            //window.dispatchEvent(new CustomEvent('pageMovement', { detail: ev.data }));
        }
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
        this.deckGlobalStatus = globalStatus;
        // broadcast status
        this.pageStatusSender.postMessage(globalStatus)
    }

    getGlobalStatus() {
        return this.deckGlobalStatus;
    }

    onEvent(ev) {
        this.updateDeckStatus(ev);
    }

    updateDeckStatus(ev) {
        const scrollTop = Math.round(window.scrollY);
        const offsetTop =
            this.containerNode.getBoundingClientRect().top +
            document.documentElement.scrollTop;

        this.updateGlobalStatus(scrollTop, offsetTop);
        this.animateCards(offsetTop, ev);
        console.log('update deck status');
    }

    animateCards(offsetTop, ev) {
        if (this.deckGlobalStatus === 1) {
            this.deckAnimation(offsetTop, ev);
        } else {
            // synthetically update scroll from wheel delta
            const scrollDistance = ev.deltaY;
            console.log('scrolldistance', scrollDistance);
            this.programmaticScrolling(window.scrollY + scrollDistance);
        }
    }

    deckAnimation(offsetTop, ev) {
        this.programmaticScrolling(offsetTop);

        const scrollDistance = ev.deltaY;
        this.animationInternalScroll += scrollDistance;

        if (this.internalScrollingDown(scrollDistance)) {
            this.animateCardsScrollDown(
                this.currentMovingCardIndex,
                scrollDistance
            );
        } else if (this.internalScrollingUp(scrollDistance)) {
            this.animateCardsScrollUp(this.currentMovingCardIndex, scrollDistance);
        } else {
            // animationGlobalStatus changes to 0 if we scroll up or to 2 if we scroll down
            this.setGlobalStatus(scrollDistance > 0 ? 2 : 0);

            this.currentMovingCardIndex =
                this.deckGlobalStatus === 0 ? 1 : this.cards.length - 1;

            this.programmaticScrolling(offsetTop);
            this.animationInternalScroll = 0;
        }
    }

    internalScrollingUp(scrollDistance) {
        return (
            scrollDistance < 0 &&
            -this.animationInternalScroll <=
            this.totalCardsHeight - GAP * (this.cards.length - 1)
        );
    }

    internalScrollingDown(scrollDistance) {
        return (
            scrollDistance > 0 &&
            this.animationInternalScroll <=
            this.totalCardsHeight - GAP * (this.cards.length - 1)
        );
    }

    programmaticScrolling(offsetTop) {
        window.scrollTo(0, offsetTop);
    }

    updateGlobalStatus(scrollTop, offsetTop) {
        if (offsetTop > scrollTop && this.deckGlobalStatus === 1) {
            this.setGlobalStatus(0);
        }

        if (
            (offsetTop < scrollTop && this.deckGlobalStatus === 0) ||
            (offsetTop > scrollTop && this.deckGlobalStatus === 2)
        ) {
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

