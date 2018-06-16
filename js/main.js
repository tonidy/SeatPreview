/**
 * main.js
 * http://www.codrops.com
 *
 * Licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Copyright 2015, Codrops
 * http://www.codrops.com
 */
import classie from "classie";

/**
 * some helper functions
 */

/** ******************************************* */
/** https://gist.github.com/desandro/1866474 * */
/** ******************************************* */
let lastTime = 0;
const prefixes = "webkit moz ms o".split(" ");
// get unprefixed rAF and cAF, if present
let requestAnimationFrame = window.requestAnimationFrame;
let cancelAnimationFrame = window.cancelAnimationFrame;
// loop through vendor prefixes and get prefixed rAF and cAF
let prefix;
for (let i = 0; i < prefixes.length; i++) {
  if (requestAnimationFrame && cancelAnimationFrame) {
    break;
  }
  prefix = prefixes[i];
  requestAnimationFrame =
    requestAnimationFrame || window[`${prefix}RequestAnimationFrame`];
  cancelAnimationFrame =
    cancelAnimationFrame ||
    window[`${prefix}CancelAnimationFrame`] ||
    window[`${prefix}CancelRequestAnimationFrame`];
}

// fallback to setTimeout and clearTimeout if either request/cancel is not supported
if (!requestAnimationFrame || !cancelAnimationFrame) {
  requestAnimationFrame = (callback, element) => {
    const currTime = new Date().getTime();
    const timeToCall = Math.max(0, 16 - (currTime - lastTime));
    const id = window.setTimeout(() => {
      callback(currTime + timeToCall);
    }, timeToCall);
    lastTime = currTime + timeToCall;
    return id;
  };

  cancelAnimationFrame = id => {
    window.clearTimeout(id);
  };
}

function throttle(fn, delay) {
  let allowSample = true;

  return e => {
    if (allowSample) {
      allowSample = false;
      setTimeout(() => {
        allowSample = true;
      }, delay);
      fn(e);
    }
  };
}

// from http://www.quirksmode.org/js/events_properties.html#position
function getMousePos(e) {
  let posx = 0;
  let posy = 0;
  if (!e) var e = window.event;
  if (e.pageX || e.pageY) {
    posx = e.pageX;
    posy = e.pageY;
  } else if (e.clientX || e.clientY) {
    posx =
      e.clientX +
      document.body.scrollLeft +
      document.documentElement.scrollLeft;
    posy =
      e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
  }
  return {
    x: posx,
    y: posy
  };
}

// equation of a line
function lineEq(y2, y1, x2, x1, currentVal) {
  // y = mx + b
  const m = (y2 - y1) / (x2 - x1);
  const b = y1 - m * x1;
  return m * currentVal + b;
}

const Modernizr = window.Modernizr;

const support = { transitions: Modernizr.csstransitions };
const transEndEventNames = {
  WebkitTransition: "webkitTransitionEnd",
  MozTransition: "transitionend",
  OTransition: "oTransitionEnd",
  msTransition: "MSTransitionEnd",
  transition: "transitionend"
};
const transEndEventName = transEndEventNames[Modernizr.prefixed("transition")];

const onEndTransition = (el, callback) => {
  const onEndCallbackFn = function(ev) {
    if (support.transitions) {
      if (ev.target != this) return;
      this.removeEventListener(transEndEventName, onEndCallbackFn);
    }
    if (callback && typeof callback === "function") {
      callback.call(this);
    }
  };
  if (support.transitions) {
    el.addEventListener(transEndEventName, onEndCallbackFn);
  } else {
    onEndCallbackFn();
  }
};

const // main container
container = document.querySelector(".container");

const // the 3D element - the room
room = container.querySelector(".cube");

const // the seat rows inside the 3D element
rows = [].slice.call(room.querySelectorAll(".rows > .row"));

const // total amount of rows
totalRows = rows.length;

const // seats
seats = [].slice.call(room.querySelectorAll(".row__seat"));

const // the plan/map
plan = document.querySelector(".plan");

const // seats on the plan/map
planseats = [].slice.call(plan.querySelectorAll(".row__seat"));

const // the screen
monitor = room.querySelector(".screen");

const // the video element
video = monitor.querySelector("video");

const // play video control
playCtrl = monitor.querySelector("button.action--play");

const // intro element
intro = monitor.querySelector(".intro");

const // 'select your seats' control
selectSeatsCtrl = intro.querySelector("button.action--seats");

const // the tilt control
tiltCtrl = document.querySelector(".action--lookaround");

const // how much the camera rotates when the user moves the mouse
tiltRotation = {
  rotateX: 25, // a relative rotation of -25deg to 25deg on the x-axis
  rotateY: 15 // a relative rotation of -15deg to 15deg on the y-axis
};

let // controls whether the tilt is active or not
tilt = false;

let // window sizes
winsize = { width: window.innerWidth, height: window.innerHeight };

const // width of one seat
seat_width = seats[0].offsetWidth;

const // number of seats per row
seats_row = rows[0].children.length;

const // the sum of the room´s left margin with the room´s right margin is four times the width of a seat
side_margin = 4 * seat_width;

const // if the following is changed, the CSS values also need to be adjusted (and vice-versa)
// distance from first row to the screen
row_front_gap = 800;

const // distance between rows
row_back = 100;

const // the gap of seats in the middle of the room (equivalent to two columns of seats)
row_gap_amount = 2;

const // perspective value
perspective = 2000;

const // transition settings for the room animations (moving camera to seat)
transitionOpts = { speed: 1000, easing: "cubic-bezier(.7,0,.3,1)" };

const // the room dimentions
roomsize = {
  x: seats_row * seat_width + side_margin + row_gap_amount * seat_width,
  y: 1000, // SCSS $cube_y
  z: 3000 // SCSS $cube_z
};

const // the initial values for the room transform
initTransform = {
  translateX: 0,
  translateY: roomsize.y / 3.5, // view from top..
  translateZ: 0,
  rotateX: -15, // ..looking down
  rotateY: 0
};

let // the current room transform
roomTransform = initTransform;

function init() {
  // scale room to fit viewport
  scaleRoom();
  // initial view (zoomed screen)
  applyRoomTransform({
    translateX: 0,
    translateY: 0,
    translateZ: 1300,
    rotateX: 0,
    rotateY: 0
  });
  // bind events
  initEvents();
}

function applyRoomTransform(transform) {
  room.style.WebkitTransform = room.style.transform = transform
    ? `translate3d(0,0,${perspective}px) rotate3d(1,0,0,${transform.rotateX}deg) rotate3d(0,1,0,${transform.rotateY}deg) translate3d(${transform.translateX}px, ${transform.translateY}px, ${transform.translateZ}px)`
    : `translate3d(0,0,${perspective}px) rotate3d(1,0,0,${roomTransform.rotateX}deg) rotate3d(0,1,0,${roomTransform.rotateY}deg) translate3d(${roomTransform.translateX}px, ${roomTransform.translateY}px, ${roomTransform.translateZ}px)`;
}

function applyRoomTransition(settings) {
  var settings = settings || transitionOpts;
  room.style.WebkitTransition = `-webkit-transform ${settings.speed}ms ${settings.easing}`;
  room.style.transition = `transform ${settings.speed}ms ${settings.easing}`;
}

function removeRoomTransition() {
  room.style.WebkitTransition = room.style.transition = "none";
}

function scaleRoom() {
  const factor = winsize.width / roomsize.x;
  container.style.WebkitTransform = container.style.transform = `scale3d(${factor},${factor},1)`;
}

function initEvents() {
  // select a seat
  const onSeatSelect = ev => {
    selectSeat(ev.target);
  };
  planseats.forEach(planseat => {
    planseat.addEventListener("click", onSeatSelect);
  });

  // enabling/disabling the tilt
  const onTiltCtrlClick = () => {
    // if tilt is enabled..
    if (tilt) {
      disableTilt();
    } else {
      enableTilt();
    }
  };
  tiltCtrl.addEventListener("click", onTiltCtrlClick);

  // mousemove event / tilt functionality
  const onMouseMove = ev => {
    requestAnimationFrame(() => {
      if (!tilt) return false;

      const mousepos = getMousePos(ev);

      const // transform values
      rotX = tiltRotation.rotateX
        ? roomTransform.rotateX -
            (2 * tiltRotation.rotateX / winsize.height * mousepos.y -
              tiltRotation.rotateX)
        : 0;

      const rotY = tiltRotation.rotateY
        ? roomTransform.rotateY +
            (2 * tiltRotation.rotateY / winsize.width * mousepos.x -
              tiltRotation.rotateY)
        : 0;

      // apply transform
      applyRoomTransform({
        translateX: roomTransform.translateX,
        translateY: roomTransform.translateY,
        translateZ: roomTransform.translateZ,
        rotateX: rotX,
        rotateY: rotY
      });
    });
  };
  document.addEventListener("mousemove", onMouseMove);

  // select seats control click (intro button): show the room layout
  const onSelectSeats = () => {
    classie.remove(intro, "intro--shown");
    classie.add(plan, "plan--shown");
    classie.add(playCtrl, "action--faded");
    zoomOutScreen(() => {
      showTiltCtrl();
    });
  };
  selectSeatsCtrl.addEventListener("click", onSelectSeats);

  // play video
  playCtrl.addEventListener("click", videoPlay);
  // ended video event
  video.addEventListener("ended", videoLoad);

  // window resize: update window size
  window.addEventListener(
    "resize",
    throttle(ev => {
      winsize = { width: window.innerWidth, height: window.innerHeight };
      scaleRoom();
    }, 10)
  );
}

function showTiltCtrl() {
  classie.add(tiltCtrl, "action--shown");
}

// select a seat on the seat plan
function selectSeat(planseat) {
  if (classie.has(planseat, "row__seat--reserved")) {
    return false;
  }
  if (classie.has(planseat, "row__seat--selected")) {
    classie.remove(planseat, "row__seat--selected");
    return false;
  }
  // add selected class
  classie.add(planseat, "row__seat--selected");

  // the real seat
  const seat = seats[planseats.indexOf(planseat)];
  // show the seat´s perspective
  previewSeat(seat);
}

// preview perspective from the selected seat. Moves the camera to that position.
function previewSeat(seat) {
  // disable tilt
  disableTilt();
  // change transition properties
  applyRoomTransition();

  // getComputedStyle: https://css-tricks.com/get-value-of-css-rotation-through-javascript/
  const st = window.getComputedStyle(seat.parentNode, null);

  const tr =
    st.getPropertyValue("-webkit-transform") ||
    st.getPropertyValue("-moz-transform") ||
    st.getPropertyValue("-ms-transform") ||
    st.getPropertyValue("-o-transform") ||
    st.getPropertyValue("transform") ||
    "Either no transform set, or browser doesn´t do getComputedStyle";

  if (tr === "none") return;

  let values = tr.split("(")[1];
  values = values.split(")")[0];
  values = values.split(",");

  const // translateY value of this seat´s row
  y = values[13];

  const // translateZ value of this seat´s row
  z = values[14];

  const // seat´s center point (x-axis)
  seatCenterX = seat.offsetLeft + side_margin / 2 + seat.offsetWidth / 2;

  const // translateX, translateY and translateZ values
  tx = seatCenterX < roomsize.x / 2
    ? initTransform.translateX + (roomsize.x / 2 - seatCenterX)
    : initTransform.translateX - (seatCenterX - roomsize.x / 2);

  const // add a small extra
  ty = roomsize.y / 2 - (roomsize.y - Math.abs(y)) + seat.offsetHeight + 10;

  const // add a small extra
  tz = Math.abs(z) + 10;

  const // calculate how much to rotate in the x-axis (the more close to the screen the more we need to rotate)
  firstRowZ = roomsize.z - row_front_gap;

  const lastRowZ = firstRowZ - (totalRows - 1 + row_gap_amount) * row_back;

  const // calculate how much to rotate in the y-axis (the more close to the screen the more we need to rotate.
  // Also the same applies when the distance from the center of the room to both sides increases.
  // for the last row:
  minRotY_1 = 0;

  const // min and max values for y rotation
  maxRotY_1 = 20;

  const initialTranslationX = 0;
  const finalTranslationX = roomsize.x / 2;
  const rotY_1 = lineEq(
    minRotY_1,
    maxRotY_1,
    initialTranslationX,
    finalTranslationX,
    tx
  );

  const // for the first row:
  minRotY_2 = 0;

  const // min and max values for y rotation
  maxRotY_2 = 50;

  const rotY_2 = lineEq(
    minRotY_2,
    maxRotY_2,
    initialTranslationX,
    finalTranslationX,
    tx
  );

  const // final:
  rotY = lineEq(rotY_1, rotY_2, lastRowZ, firstRowZ, Math.abs(z));

  // room transforms
  roomTransform = {
    translateX: tx,
    translateY: ty,
    translateZ: tz,
    rotateX: 0, // rotX,
    rotateY: rotY
  };

  // apply transform
  applyRoomTransform();

  onEndTransition(room, () => {
    removeRoomTransition();
  });
}

function zoomOutScreen(callback) {
  applyRoomTransition({ speed: 1500, easing: "ease" });
  applyRoomTransform(initTransform);
  onEndTransition(room, () => {
    removeRoomTransition();
    callback.call();
  });
}

function disableTilt() {
  classie.add(tiltCtrl, "action--disabled");
  tilt = false;
}

function enableTilt() {
  classie.remove(tiltCtrl, "action--disabled");
  tilt = true;
}

function videoPlay() {
  // hide the play control
  classie.remove(playCtrl, "action--shown");
  video.currentTime = 0;
  video.play();
}

function videoLoad() {
  // show the play control
  classie.add(playCtrl, "action--shown");
  video.load();
}

init();
