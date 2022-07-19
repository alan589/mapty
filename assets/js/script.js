import 'regenerator-runtime/runtime';
import 'core-js/stable';


import * as leaflet from 'leaflet';
const leafletDraw = require('leaflet-draw');

import marker from 'url:../imgs/marker.png';
import running from 'url:../imgs/running.png';
import cycling from 'url:../imgs/cycling.png';
import loading from 'url:../imgs/loading.png';
import clock from 'url:../imgs/clock.png';
import feet from 'url:../imgs/feet.png';
import elevation from 'url:../imgs/elevation.png';
import lightning from 'url:../imgs/lightning.png';

import clear from 'url:../imgs/clear.png';
import cloudy from 'url:../imgs/cloudy.png';
import ishower from 'url:../imgs/ishower.png';
import lightrain from 'url:../imgs/lightrain.png';
import lightsnow from 'url:../imgs/lightsnow.png';
import mcloudy from 'url:../imgs/mcloudy.png';
import oshower from 'url:../imgs/oshower.png';
import pcloudy from 'url:../imgs/pcloudy.png';
import rain from 'url:../imgs/rain.png';
import ts from 'url:../imgs/ts.png';
import tsrain from 'url:../imgs/tsrain.png';



const icons = {'marker': marker, 'running': running, 
'cycling': cycling, 'loading': loading, 'clock': clock,
'feet': feet, 'elevation': elevation, 'lightning': lightning,
'clear': clear, 'cloudy': cloudy, 'ishower': ishower, 'lightrain': lightrain,
'lightsnow': lightsnow, 'mcloudy': mcloudy, 'oshower': oshower, 'pcloudy': pcloudy,
'rain': rain, 'ts': ts, 'tsrain': tsrain};



class Workout {
  _date = new Date();
  id = (Date.now() + "").slice(-10);
  point;
  weather;

  constructor(distance, duration, point, weather, address) {
    this.distance = distance; // in km
    this.duration = duration; // in min
    this.point = point;
    this.weather = weather;
    this.address = address;
  }

  _description() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

    let location = this.address?.suburb ?? this.address?.city ?? "";

    this._description = `${
      this.type === "running" ? "Run" : "Cycle"
    } in ${location === '' ? '' : location + ', '} ${this.address.country} on ${
      months[this._date.getMonth()]
    } ${this._date.getDate()}`;
  }

  set description(description){
    this._description = description;
  }

  get description() {
    return this._description;
  }

  set date(date) {
    this._date = date;
  }

  get date() {
    return this._date;
  }
}

class Running extends Workout {
  type = "running";

  constructor(distance, duration, cadence, point, weather, description) {
    super(distance, duration, point, weather, description);
    this.cadence = cadence;
    this.calcPace();
    this._description();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = "cycling";

  constructor(distance, duration, elevationGain, point, weather, description) {
    super(distance, duration, point, weather, description);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._description();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

///////////////////////////////////////
// APPLICATION ARCHITECTURE
const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");
const sortBtn = document.querySelector(".sort-btn");
const sortOption = document.querySelector("#sort-select");
const deleteAllBtn = document.querySelector(".delete-btn");
const confirmForm = document.querySelector(".confirmation-form");
const startMsg = document.querySelector(".start-message");
const fitBtn = document.querySelector(".fit-workouts");

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #drawlayers = [];
  #currentForm;
  #lastWorkoutClicked;
  #sortedAsc;
  #drawnItems;
  #drawControl;
  #disableDraw;
  #drawOptions;

  constructor() {
    this.#drawOptions = {
      shapeOptions: {
        color: "#03a9f4",
        weight: 5,
        opacity: 1,
      },
    };

    const iconPng = L.icon({
      iconUrl: icons['marker'],
      iconSize: [40, 40],
      iconAnchor: [18, 41],
      popupAnchor: [0, -41],
    });

    L.Marker.prototype.options.icon = iconPng;

    this.#drawnItems = new L.FeatureGroup();
    this.#drawControl = new L.Control.Draw({
      edit: {
        featureGroup: this.#drawnItems,
      },
      draw: {
        circle: false,
        circlemarker: false,
        polyline: this.#drawOptions,
        polygon: this.#drawOptions,
        rectangle: this.#drawOptions,
        marker: {icon: iconPng}
      },
    });

    this.#disableDraw = new L.Control.Draw({
      edit: {
        featureGroup: this.#drawnItems,
        edit: false,
      },
      draw: false,
    });
    
    // Get user's position
    this._getPosition();

    // Attach event handlers
    deleteAllBtn.addEventListener(
      "click",

      this._displayConfirmationForm.bind(this)
    );

    confirmForm.addEventListener(
      "click",
      (e) => e.target.textContent === "Ok" ? this._reset() : this._hiddenConfirmationForm()
      .bind(this)
    );

    fitBtn.addEventListener("click", this._fitWorkouts.bind(this));

    sortBtn.addEventListener(
      "click",
      function (e) {
        if (!this.#sortedAsc) {
          if (sortOption.value === "distance")
            this.#workouts.sort((a, b) => a.distance - b.distance);
          if (sortOption.value === "type")
            this.#workouts.sort((a, b) => (a.type < b.type ? 1 : -1));
          if (sortOption.value === "date")
            this.#workouts.sort((a, b) => (a.date < b.date ? 1 : -1));
          if (sortOption.value === "duration")
            this.#workouts.sort((a, b) => a.duration - b.duration);
          this.#sortedAsc = true;
          sortBtn.innerHTML = "Sort &downarrow;";
        } else {
          if (sortOption.value === "distance")
            this.#workouts.sort((a, b) => b.distance - a.distance);
          if (sortOption.value === "type")
            this.#workouts.sort((a, b) => (a.type > b.type ? 1 : -1));
          if (sortOption.value === "date")
            this.#workouts.sort((a, b) => (a.date > b.date ? 1 : -1));
          if (sortOption.value === "duration")
            this.#workouts.sort((a, b) => b.duration - a.duration);
          this.#sortedAsc = false;
          sortBtn.innerHTML = "Sort &uparrow;";
        }

        this._deleteWorkoutList();
        this.#workouts.forEach((w) =>
          this._insertWorkout(containerWorkouts, "beforeend", w)
        );
      }.bind(this)
    );

    form.addEventListener(
      "submit",
      function (e) {
        if (
          "newWorkout" === this.#currentForm ||
          undefined === this.#currentForm
        )
          this._newWorkout(e);
        else if ("editWorkout" === this.#currentForm) this._editWorkout(e);
      }.bind(this)
    );

    inputType.addEventListener("change", this._toggleElevationField);

    containerWorkouts.addEventListener(
      "click",
      function (e) {
        if (!this.#map) return;

        const workoutEl = e.target.closest(".workout");
        if (!workoutEl) return;

        if (e.target.classList.contains("workout__edit")) this._openEdit(e);
        else if (e.target.classList.contains("workout__close"))
          this._closeEdit(e);
        else if (e.target.closest(".workout__popup")) {
          this.#lastWorkoutClicked = workoutEl;
          if (e.target.classList.contains("edit")) {
            this._setControlDraw(this.#disableDraw, this.#drawControl);
            this._displayEditForm(workoutEl);
          }
          if (e.target.classList.contains("delete"))
            this._deleteWorkout(workoutEl);
        } else {
          this._hidePopups();
          this._moveToPopup(workoutEl);
        }
      }.bind(this)
    );
  }

  _getPosition() {
    // async / await version
    const getPosition = async function () {
      try{
          const pos = await new Promise(function (resolve, reject) {
            navigator.geolocation.getCurrentPosition(resolve, (err) =>
              reject("Could not get your position")
            );
          });
          this._loadMap(pos);
      }
      catch(err){
        alert(err);
      }
    }
    getPosition.bind(this)();
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    console.log(`https://www.google.pt/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    const osm = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    );

    const google = L.tileLayer(
      "http://www.google.com/maps/vt?lyrs=s@189&gl=cn&x={x}&y={y}&z={z}",
      {
        attribution: '&copy; <a href="http://www.google.com">Google</a>',
      }
    );

    this.#map = L.map("map", {
      center: new L.LatLng(latitude, longitude),
      zoom: this.#mapZoomLevel,
    });

    this.#map.addLayer(this.#drawnItems);

    L.control
      .layers(
        {
          google: google,
          osm: osm.addTo(this.#map),
        },
        {},
        { position: "topright", collapsed: true }
      )
      .addTo(this.#map);

    this.#map.addControl(this.#drawControl);

    document
      .querySelector(
        "#map > div.leaflet-control-container > div.leaflet-top.leaflet-right > div > section"
      )
      .insertAdjacentHTML(
        "afterbegin",
        `<label><div><span>Maps</span></div></label>`
      );

    const reOpenPopup = (e) =>
      this.#drawnItems.getLayers(e).forEach((l) => l.openPopup());

    ["draw:editstop", "draw:deletestop"].forEach(ev => this.#map.on(ev, reOpenPopup));

    this.#map.on(
      L.Draw.Event.CREATED,
      function (event) {
        const layer = event.layer;
        const layerID = this.#drawnItems.getLayerId(layer);
        this.#mapEvent = event;

        if (event.layerType === "marker") {
          this.#map.addControl(this.#drawControl);
          this.#currentForm = "newWorkout";
          startMsg.style.display = "none";
          this._hidePopups();
          this._hiddenWorkoutList();
          this._showForm();
          this._setControlDraw(this.#disableDraw, this.#drawControl);
        }

        if (event.layerType !== "marker") {
          this.#drawnItems.addLayer(layer);
          const layerJSON = layer.toGeoJSON();
          layerJSON.id = layerID;
          this.#drawlayers.push(layerJSON);
          this._setLocalStorageDrawlayer();
        }
      }.bind(this)
    );

    this.#map.on(
      L.Draw.Event.EDITED,
      function (event) {
        const layers = event.layers;
        layers.eachLayer(
          function (layer) {
            const layerID = this.#drawnItems.getLayerId(layer);
            const layerJSON = layer.toGeoJSON();

            if (layerJSON.geometry.type === "Point") {
              const workout = this.#workouts.find(
                (w) => w.point.id === layerID
              );
              workout.point = layerJSON;
              workout.point.id = layerID;
              this._setLocalStorageWorkout();
            } else {
              this.#drawnItems.addLayer(layer);
              const indexLayer = this.#drawlayers.findIndex(
                (l) => l.id === layerID
              );
              layerJSON.id = layerID;
              this.#drawlayers[indexLayer] = layerJSON;
              this._setLocalStorageDrawlayer();
            }
          }.bind(this)
        );
      }.bind(this)
    );

    this.#map.on(
      L.Draw.Event.DELETED,
      function (e) {
        const layers = e.layers;
        layers.eachLayer(
          function (layer) {
            const layerJSON = layer.toGeoJSON();
            const layerID = this.#drawnItems.getLayerId(layer);

            if (layerJSON.geometry.type === "Point") {
              const workout = this.#workouts.find(
                (w) => w.point.id === layerID
              );
              const workoutList = Array.from(
                document.querySelectorAll(".workouts li")
              );
              const workoutEl = workoutList.find(
                (l) => l.dataset.id === workout.id
              );
              const workoutIndex = this.#workouts.findIndex(
                (w) => w.id === workoutEl.dataset.id
              );
              this.#workouts.splice(workoutIndex, 1);
              workoutEl.remove();
              this._setLocalStorageWorkout();
              if (this.#workouts.length === 0) startMsg.style.display = "block";
            } else {
              const drawIndex = this.#drawlayers.findIndex(
                (d) => d.id === layerID
              );
              this.#drawlayers.splice(drawIndex, 1);
              this._setLocalStorageDrawlayer();
            }
          }.bind(this)
        );
      }.bind(this)
    );

    // Get data from local storage
    this._getLocalStorageWorkouts();
    this._getLocalStorageDrawlayers();
  }

  async _newWorkout(e) {
    e.preventDefault();

    if (e.submitter.classList.contains("form__btn-ok")) {
      if (!this._validInputs()) return;

      let workout;
      this._resetForm();

      const { lat, lng } = this.#mapEvent.layer.getLatLng();

      const layer = L.marker([lat, lng]);
      this.#drawnItems.addLayer(layer);

      const pointJSON = layer.toGeoJSON();
      pointJSON.id = this.#drawnItems.getLayerId(layer);

      try 
        {
            this._loadSpinner()
            // get weather data from api
            const weatherData = await Promise.race([this._timeout(20), this._getJson(`https://www.7timer.info/bin/api.pl?lon=${lng}&lat=${lat}&product=civillight&output=json`)])
             
            const weather = weatherData.dataseries[0].weather;
              
            // get location data from api
            const locationData = await Promise.race([this._timeout(20), this._getJson(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&accept-language=en-US`)]);
            const { suburb, country, city } = locationData.address;
            console.log(suburb, city, country);

            // If workout running, create running object
            if (inputType.value === "running")
                    workout = new Running(
                      +inputDistance.value,
                      +inputDuration.value,
                      +inputCadence.value,
                      pointJSON,
                      weather,
                      { suburb, country, city });
       

            // If workout cycling, create cycling object
            if (inputType.value === "cycling")
                    workout = new Cycling(
                      +inputDistance.value,
                      +inputDuration.value,
                      +inputElevation.value,
                      pointJSON,
                      weather,
                      { suburb, country, city }
                    );

            // Add new object to workout array
            this.#workouts.push(workout);

            // Render workout on list
            this._removeSpinner();
            this._insertWorkout(form, "afterend", workout);
            this.#map.panTo([lat, lng]);
            this._renderWorkoutMarker(layer, workout);
            // Set local storage to all workouts
            this._setLocalStorageWorkout();
        }catch(err){
          alert(err.message);
          console.error(err);
          this._removeSpinner();
          this.#drawnItems.removeLayer(pointJSON.id);
        }

      // clear input fields
      this._clearInputs();
      startMsg.style.display = "none";  
    }

    if (e.submitter.classList.contains("form__btn-cancel")) {
      this.#drawnItems.removeLayer(this.#mapEvent.layer);
      this._resetForm();
    }
  }

  _resetForm() {
    this._hideForm();
    this._showWorkoutList();
    this.#currentForm = undefined;
    this._setControlDraw(this.#drawControl, this.#disableDraw);
  }

  async _getJson(url) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      return data;
    } catch (err) {
      throw new Error(`Não foi possível obter dados do API.\n${err}`);
    }
  }

  _editWorkout(e) {
    e.preventDefault();
    if (e.submitter.classList.contains("form__btn-ok")) {
      if (this._validInputs()) {
        const workoutIndex = this.#workouts.findIndex(
          (workout) => workout.id === this.#lastWorkoutClicked.dataset.id
        );
        const workoutObj = this.#workouts[workoutIndex];
        if (inputType.value !== workoutObj.type) {
          if (inputType.value === "running") {
            this.#workouts[workoutIndex] = new Running(
              +inputDistance.value,
              +inputDuration.value,
              +inputCadence.value,
              workoutObj.point,
              workoutObj.weather,
              workoutObj.address
            );
          } else {
            this.#workouts[workoutIndex] = new Cycling(
              +inputDistance.value,
              +inputDuration.value,
              +inputElevation.value,
              workoutObj.point,
              workoutObj.weather,
              workoutObj.address
            );
          }
          this.#workouts[workoutIndex].date = workoutObj.date;
          this.#workouts[workoutIndex].id = workoutObj.id;

          let layer = this.#drawnItems.getLayer(
            this.#workouts[workoutIndex].point.id
          );
          layer.closePopup();
          this.#map.removeLayer(layer);

          const [lng, lat] =
            this.#workouts[workoutIndex].point.geometry.coordinates;

          layer = L.marker([lat, lng]);

          this.#workouts[workoutIndex].point.id =
            this.#drawnItems.getLayerId(layer);

          this.#drawnItems.addLayer(layer);

          this._renderWorkoutMarker(layer, this.#workouts[workoutIndex]);
        } else {
          workoutObj.distance = +inputDistance.value;
          workoutObj.duration = +inputDuration.value;

          if (workoutObj.type === "running") {
            workoutObj.cadence = +inputCadence.value;
            workoutObj.calcPace();
          } else {
            workoutObj.elevationGain = +inputElevation.value;
            workoutObj.calcSpeed();
          }

          this._setTooltip(
            workoutObj,
            this.#drawnItems.getLayer(this.#workouts[workoutIndex].point.id)
          );
        }

        this._setLocalStorageWorkout();

        this._insertWorkout(
          this.#lastWorkoutClicked,
          "afterend",
          this.#workouts[workoutIndex]
        );
        this.#lastWorkoutClicked.remove();
        this._showWorkoutList();
        this._hideForm();
        this.#currentForm = undefined;
        this._setControlDraw(this.#drawControl, this.#disableDraw);
      }
    } else {
      this._showWorkoutList();
      this._hideForm();
      this.#currentForm = undefined;
      this._setControlDraw(this.#drawControl, this.#disableDraw);
    }
  }

  _setControlDraw(controlAdd, controlRemove) {
    controlAdd.addTo(this.#map);
    controlRemove.remove();
  }

  _deleteWorkout(workoutEl) {
    const workoutIndex = this.#workouts.findIndex(
      (w) => w.id === workoutEl.dataset.id
    );
    this.#drawnItems.removeLayer(this.#workouts[workoutIndex].point.id);
    this.#workouts.splice(workoutIndex, 1);
    workoutEl.remove();
    this._setLocalStorageWorkout();
    if (this.#workouts.length === 0) startMsg.style.display = "block";
  }

  _displayEditForm(workoutEl) {
    if (workoutEl.classList.contains("workout--cycling")) {
      inputType.value = "cycling";
      inputElevation
        .closest(".form__row")
        .classList.remove("form__row--hidden");
      inputCadence.closest(".form__row").classList.add("form__row--hidden");
    } else {
      inputType.value = "running";
      inputElevation.closest(".form__row").classList.add("form__row--hidden");
      inputCadence.closest(".form__row").classList.remove("form__row--hidden");
    }
    this.#currentForm = "editWorkout";
    this._hidePopups();
    this._showForm();
    this._hiddenWorkoutList();
  }

  _hiddenWorkoutList() {
    document
      .querySelectorAll(".workouts li")
      .forEach((li) => li.classList.add("hidden-workouts"));
  }
  _showWorkoutList() {
    document
      .querySelectorAll(".workouts li")
      .forEach((li) => li.classList.remove("hidden-workouts"));
  }

  _closeEdit(e) {
    this._hidePopups();
  }

  _openEdit(e) {
    this._hidePopups();
    e.target.previousElementSibling.classList.remove("hidden");
    e.target.previousElementSibling.style.right = "0";
  }
  _hidePopups() {
    document.querySelectorAll(".workout__popup").forEach((popup) => {
      popup.classList.add("hidden");
      popup.style.right = "-100px";
    });
  }

  _showForm() {
    form.classList.remove("hidden");
    inputDistance.focus();
  }

  _clearInputs(){
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
      "";
  }

  _hideForm() {
    form.style.display = "none";
    form.classList.add("hidden");
    setTimeout(() => (form.style.display = "grid"), 300);
  }

  _toggleElevationField() {
    inputElevation.closest(".form__row").classList.toggle("form__row--hidden");
    inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
  }

  _displayInvalidMsg() {
    form.style.transition = "none";
    form.classList.add("invalid-input");
    setTimeout(() => {
      form.classList.remove("invalid-input");
      setTimeout(
        () => (form.style.transition = "all 0.5s, transform 1ms"),
        300
      );
    }, 2500);
  }

  _validInputs() {
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    const validInputs = (...inputs) =>
      inputs.every((inp) => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every((inp) => inp > 0);

    if (type === "running") {
      const cadence = +inputCadence.value;
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        this._displayInvalidMsg();
        return false;
      }
    }

    if (type === "cycling") {
      const elevation = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration, elevation)
      ) {
        this._displayInvalidMsg();
        return false;
      }
    }
    return true;
  }

  _setTooltip(workout, layer) {
    let html = `
        <li class="workout-tooltip">
          <div class="workout__details">
             <span><img class="tooltip__icon" src="${icons[workout.type]}"></span> 
            <span class="tooltip__value">${workout.distance}</span>
            <span class="tooltip__unit">km</span>
          </div>
          <div class="workout__details">
            <span><img class="tooltip__icon" src="${icons['clock']}"></span>
            <span class="tooltip__value">${workout.duration}</span>
            <span class="tooltip__unit">min</span>
          </div>
      `;

    if (workout.type === "running")
      html += `
        <div class="workout__details">
             <span><img class="tooltip__icon" src="${icons['lightning']}"></span> 
            <span class="tooltip__value">${workout.pace.toFixed(1)}</span>
            <span class="tooltip__unit">min/km</span>
          </div>
          <div class="workout__details">
             <span><img class="tooltip__icon" src="${icons['feet']}"></span> 
            <span class="tooltip__value">${workout.cadence}</span>
            <span class="tooltip__unit">spm</span>
          </div>
        </li>
      `;

    if (workout.type === "cycling")
      html += `
        <div class="workout__details">
             <span><img class="tooltip__icon" src="${icons['lightning']}"></span> 
            <span class="tooltip__value">${workout.speed.toFixed(1)}</span>
            <span class="tooltip__unit">km/h</span>
          </div>
          <div class="workout__details">
             <span><img class="tooltip__icon" src="${icons['elevation']}"></span> 
            <span class="tooltip__value">${workout.elevationGain}</span>
            <span class="tooltip__unit">m</span>
          </div>
        </li>
      `;

    layer
      .bindTooltip(
        L.tooltip({ className: "tooltip-bg", opacity: 1, pane: "popupPane" })
      )
      .setTooltipContent(html);
  }

  _setPopup(workout, layer) {
    layer
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `<div class='popup__flex'>
           <img class='workout__icon-popup' src='${icons[workout.type]}'/>
           <p class="popup__text">
           ${workout.description}
           </p> 
           <img class='workout__weather' src='${icons[workout.weather]}'/>
        </div>`
      )
      .openPopup();
  }

  _renderWorkoutMarker(layer, workout) {
    this._setPopup(workout, layer);
    this._setTooltip(workout, layer);

    layer.off("click");
    layer.on(
      "click",
      function (e) {
        this.#map.panTo(e.target.getLatLng());
        if (!e.target.isPopupOpen()) e.target.openPopup();
        const workoutId = this.#workouts.find(
          (w) => w.point.id === this.#drawnItems.getLayerId(e.target)
        ).id;
        const [workoutEl] = Array.from(
          document.querySelectorAll(".workouts li")
        ).filter((li) => li.dataset.id === workoutId);
        workoutEl.focus();
        workoutEl.blur();
        workoutEl.classList.add("workout-hover");
        setTimeout(() => workoutEl.classList.remove("workout-hover"), 1000);
      }.bind(this)
    );
  }

  _deleteWorkoutList() {
    document.querySelectorAll(".workouts li").forEach((l) => l.remove());
  }

  _loadSpinner(){
    let html = `<li class="workout spinner">
    <img src="${icons['loading']}">
    </li>`;

    form.insertAdjacentHTML('afterend', html);
  }
  _removeSpinner(){
    document.querySelector('.workouts li').remove();
  }

  _insertWorkout(selector, pos, workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${
      workout.id
    }" tabindex="0">
        <div class="workout__popup hidden">
            <p class="edit">Edit</p>
            <p class="delete">Delete</p>
            <span class="workout__close">x</span>
        </div>
        <span class="workout__edit">...</span>
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span><img class='workout__icon' src='${icons[workout.type]}'/></span> 
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span><img class='workout__icon' src='${icons['clock']}'/></span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === "running")
      html += `
        <div class="workout__details">
           <span><img class='workout__icon' src='${icons['lightning']}'/></span> 
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
           <span><img class='workout__icon' src='${icons['feet']}'/></span> 
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;

    if (workout.type === "cycling")
      html += `
        <div class="workout__details">
           <span><img class='workout__icon' src='${icons['lightning']}'/></span> 
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span><img class='workout__icon' src='${icons['elevation']}'/></span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;

    selector.insertAdjacentHTML(pos, html);
  }

  _setViewWorkout(coords, panDuration, zoomLevel = this.#mapZoomLevel) {
    this.#map.setView(coords, zoomLevel, {
      animate: true,
      pan: {
        duration: panDuration,
      },
    });
  }

  _moveToPopup(workoutEl) {
    const workout = this.#workouts.find(
      (work) => work.id === workoutEl.dataset.id
    );

    const [lng, lat] = workout.point.geometry.coordinates;
    this._setViewWorkout([lat, lng], 1);
  }
  _fitWorkouts() {
    const bounds = this.#drawnItems.getBounds().pad(0.1);
    this.#map.fitBounds(bounds);
  }

  _setLocalStorageWorkout() {
    localStorage.setItem("workouts", JSON.stringify(this.#workouts));
  }
  _setLocalStorageDrawlayer() {
    localStorage.setItem("drawlayers", JSON.stringify(this.#drawlayers));
  }

  _getLocalStorageDrawlayers() {
    const drawlayersData = JSON.parse(localStorage.getItem("drawlayers"));

    if (!drawlayersData) return;

    drawlayersData.forEach((draw) => {
      L.geoJson(draw, {
        onEachFeature: function (feature, layer) {
          this.#drawnItems.addLayer(layer);
          draw.id = this.#drawnItems.getLayerId(layer);
          this.#drawlayers.push(draw);
        }.bind(this),
        style: function (feature) {
          return this.#drawOptions.shapeOptions;
        }.bind(this),
      });
    });
  }

  _getLocalStorageWorkouts() {
    const workoutsData = JSON.parse(localStorage.getItem("workouts"));
    let workout;

    if (!workoutsData || workoutsData.length === 0) {
      startMsg.style.display = "block";
      return;
    }

    workoutsData.forEach((work) => {
      L.geoJson(work.point, {
        onEachFeature: function (feature, layer) {
          const layerMarker = L.marker(layer.getLatLng());

          this.#drawnItems.addLayer(layerMarker);
          work.point.id = this.#drawnItems.getLayerId(layerMarker);
          if (work.type === "running")
            workout = new Running(
              work.distance,
              work.duration,
              work.cadence,
              work.point,
              work.weather,
              work.address
            );

          if (work.type === "cycling")
            workout = new Cycling(
              work.distance,
              work.duration,
              work.elevationGain,
              work.point,
              work.weather,
              work.address
            );

          workout.date = work._date;
          workout.description = work._description;

          this.#workouts.push(workout);
          this._renderWorkoutMarker(layerMarker, workout);
          this._insertWorkout(form, "afterend", workout);
        }.bind(this),
      });
    });
  }

  _displayConfirmationForm() {
    this._hiddenWorkoutList();
    this._hideForm();
    confirmForm.classList.remove("display-none");
  }
  _hiddenConfirmationForm() {
    this._showWorkoutList();
    confirmForm.classList.add("display-none");
  }

  _reset() {
    localStorage.removeItem("workouts");
    localStorage.removeItem("drawlayers");
    location.reload();
  }

  _setDrawColor(color) {
    this.#drawControl.options.draw.polyline.shapeOptions.color = color;
    this.#drawControl.options.draw.polygon.shapeOptions.color = color;
    this.#drawControl.options.draw.rectangle.shapeOptions.color = color;
  }

  _timeout(sec) {
    return new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error('Request took too long!'));
      }, sec * 1000);
    });
  }

  get workouts() {
    return this.#workouts;
  }
}

const app = new App();
