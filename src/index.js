import Auth from './auth/TwitterAuth';
import GameSetup from './games/Game';
import CustomGame from './games/CustomGame';
import Voting from './voting/RankedChoiceVoting';
import { render, initDom } from './views';

import $ from 'jquery';

import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';

const DEBUG = ( document.location.search === '?debug' );

// Production
let config = {
  apiKey: 'AIzaSyALThai8CYhmSG91fsN499Kl-Mf1vP-_pY',
  authDomain: 'resistance-1ec7a.firebaseapp.com',
  databaseURL: 'https://resistance-1ec7a.firebaseio.com',
  projectId: 'resistance-1ec7a',
  storageBucket: 'resistance-1ec7a.appspot.com',
  messagingSenderId: '383282710233'
};

if( DEBUG ) {
  config = {
    apiKey: 'AIzaSyDhSSM3kQmouCbLmrg1GK-qSMZKuLFAW1k',
    authDomain: 'test-60f3a.firebaseapp.com',
    databaseURL: 'https://test-60f3a.firebaseio.com',
    projectId: 'test-60f3a',
    storageBucket: 'test-60f3a.appspot.com',
    messagingSenderId: '997935352484'
  };
}

firebase.initializeApp(config);

const appState = window.app = {
  presence: {},
  currentPlayer: undefined,
  selected: {},
  ballots: {},
  custom: {
    isCustom: false,
    cards: []
  },
  ui: {}
};

$(function () {
  initDom(appState);
  render(appState);
});

appState.resetGame = function () {
  gameStateRef.remove();
  render(appState);
};

appState.signIn = function () {
  auth.signIn();
};

appState.startGame = function () {
  resolveVoting();
};

/* Auth */
const auth = new Auth({
  firebase,
  onAuth(user){
    if (user) {
      const userRef = appState.addPresence(user);
      userRef.onDisconnect().remove();
      appState.currentPlayer = user;
    }
    else {
      appState.currentPlayer = undefined;
    }
    render(appState);
  },
  onError(error) {
    appState.error = error;
    render(appState);
  }
});

/* Presence */
const presenceRef = firebase.database().ref('presence');
presenceRef.on('value', function (snap) {
  appState.presence = snap.val();
  appState.presenceCount = Object.keys(appState.presence).length;
  render(appState);
});

appState.addPresence = function (user) {
  const userRef = firebase.database().ref('presence/' + user.uid);
  userRef.update(user);
  return userRef;
};

/* Voting */
const ballotsRef = firebase.database().ref('ballots');
ballotsRef.on('value', snapshot => {
  const { currentPlayer } = appState;
  const ballots = snapshot.val() || {};
  appState.ballots = ballots;
  appState.ballotCount = Object.keys(ballots).length;
  if (currentPlayer){
    appState.selected = ballots[currentPlayer.uid] || {};
  }
  render(appState);
});

appState.setSelectedGames = function (primary = '', secondary = '') {
  const {currentPlayer} = appState;
  if (!appState.currentPlayer)
    return;
  const ownBallotRef = firebase.database().ref(`ballots/${currentPlayer.uid}`);
  ownBallotRef.update({ primary, secondary });
  ownBallotRef.onDisconnect().remove();
};

function resolveVoting () {
  const { ballots } = appState;
  const ballotsList = Object.keys(ballots).map(uid => {
    const ballot = ballots[uid];
    return [ballot.primary, ballot.secondary];
  });
  const results = Voting.results({ballots: ballotsList, tiebreak: true});
  onGameType(results.winners[0]);
}

/* Game Setup */
const gameStateRef = firebase.database().ref('state');
gameStateRef.on('value', function (snap) {
  appState.gameState = snap.val();
  appState.currentPlayer = firebase.auth().currentUser;
  render(appState);
});

function onGameType (type) {
  const gameState = GameSetup(type, appState.presence);
  gameStateRef.set(gameState);
}

/* Custom Game */
const customGameRef = firebase.database().ref('custom');
customGameRef.on('value', snapshot => {
  const restore = snapshot.val();
  appState.isCustom = restore.isCustom || false;
  appState.cards = restore.cards || [];
  render(appState);
});

appState.addCustomCard = function (card) {
  appState.custom.cards.push(card);
  customGameRef.update(appState.custom);
};

appState.removeCustomCard = function (card) {
  const i = appState.custom.cards.indexOf(card);
  appState.custom.cards.splice(i, 1);
  customGameRef.update(appState.custom);
};

appState.setCustomGame = function () {
  appState.custom.isCustom = true;
  customGameRef.update(appState.custom);
  render(appState);
};

appState.startCustomGame = function () {
  const custom = {
    ...CustomGame,
    cards: appState.custom.cards
  };
  const gameState = GameSetup(custom, appState.presence);
  gameStateRef.set(gameState);
  render(appState);
};
