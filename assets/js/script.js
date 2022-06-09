"use strict";

class Workout {
  date = new Date();
  id = (Date.now() + "").slice(-10);
  point;

  constructor(distance, duration, point) {
    this.distance = distance; // in km
    this.duration = duration; // in min
    this.point = point;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = "running";

  constructor(distance, duration, cadence, point) {
    super(distance, duration, point);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = "cycling";

  constructor(distance, duration, elevationGain, point) {
    super(distance, duration, point);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
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

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #drawlayers = [];
  #currentForm;
  #lastWorkoutClicked;
  #sortedAsc;
  #drawnItems = new L.FeatureGroup();

  constructor() {
    // Get user's position
    this._getPosition();

    // Attach event handlers
    deleteAllBtn.addEventListener("click", this.reset);

    sortBtn.addEventListener(
      "click",
      function (e) {
        if (!this.#sortedAsc) {
          if (sortOption.value === "distance")
            this.#workouts.sort((a, b) => a.distance - b.distance);
          if (sortOption.value === "type")
            this.#workouts.sort((a, b) => (a.type < b.type ? 1 : -1));
          if (sortOption.value === "date")
            this.#workouts.sort((a, b) => a.date - b.date);
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
            this.#workouts.sort((a, b) => b.date - a.date);
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
          if (e.target.classList.contains("edit"))
            this._displayEditForm(workoutEl);
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
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert("Could not get your position");
        }
      );
  }

  _loadMap(position) {
    // drawControl.options.draw.polyline.shapeOptions.color = '#0000FF';

    const { latitude } = position.coords;
    const { longitude } = position.coords;

    console.log(`https://www.google.pt/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];
    const drawOptions = {
      shapeOptions: {
        color: "red",
        weight: 5,
        opacity: 1,
      },
    };

    const osm = L.tileLayer(
      "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    );

    const google = L.tileLayer(
      "http://www.google.cn/maps/vt?lyrs=s@189&gl=cn&x={x}&y={y}&z={z}",
      {
        attribution: "google",
      }
    );

    this.#map = L.map("map").setView(coords, this.#mapZoomLevel);
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

    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: this.#drawnItems,
      },
      draw: {
        circle: false,
        polyline: drawOptions,
        polygon: drawOptions,
        rectangle: drawOptions,
      },
    });

    this.#map.addControl(drawControl);

    document
      .querySelector(
        "#map > div.leaflet-control-container > div.leaflet-top.leaflet-right > div > section"
      )
      .insertAdjacentHTML(
        "afterbegin",
        `<label><div><span>Maps</span></div></label>`
      );

    const reOpenpoup = (e) => this.#drawnItems.getLayers(e).forEach((l) => l.openPopup());
    this.#map.on("draw:editstop", reOpenpoup);
    this.#map.on("draw:deletestop", reOpenpoup);

    this.#map.on(
      L.Draw.Event.CREATED,
      function (event) {
        const layer = event.layer;
        const layerID = this.#drawnItems.getLayerId(layer);
        this.#mapEvent = event;
        this.#drawnItems.addLayer(layer);

        console.log(this.#drawnItems.getLayerId(layer));

        if (event.layerType === "marker") {
          console.log(event.layer.getLatLng());
          this.#currentForm = "newWorkout";
          this._hidePopups();
          this._showForm();
        }

        if (event.layerType !== "marker") {
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
        console.log(layers);
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
              // layer.openPopup();
              this._setLocalStorageWorkout();
            } else {
              this.#drawnItems.addLayer(layer);
              const indexLayer = this.#drawlayers.findIndex(
                (l) => l.id === layerID
              );
              layerJSON.id = layerID;
              this.#drawlayers[indexLayer] = layerJSON;

              console.log(this.#drawlayers[indexLayer]);
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

  _newWorkout(e) {
    e.preventDefault();

    if (e.submitter.classList.contains("form__btn-ok")) {
      let workout;

      if (!this._validInputs()) {
        return;
      }

      const pointJSON = this.#mapEvent.layer.toGeoJSON();
      pointJSON.id = this.#drawnItems.getLayerId(this.#mapEvent.layer);

      // If workout running, create running object
      if (inputType.value === "running")
        workout = new Running(
          +inputDistance.value,
          +inputDuration.value,
          +inputCadence.value,
          pointJSON
        );

      // If workout cycling, create cycling object
      if (inputType.value === "cycling")
        workout = new Cycling(
          +inputDistance.value,
          +inputDuration.value,
          +inputElevation.value,
          pointJSON
        );

      // Add new object to workout array
      this.#workouts.push(workout);

      // Render workout on map as marker
      this._renderWorkoutMarker(this.#mapEvent.layer, workout);

      // Render workout on list
      this._insertWorkout(form, "afterend", workout);

      // Set local storage to all workouts
      this._setLocalStorageWorkout();
    }

    if (e.submitter.classList.contains("form__btn-cancel")) {
      this.#drawnItems.removeLayer(this.#mapEvent.layer);
    }

    // Hide form + clear input fields
    this._hideForm();
  }

  _editWorkout(e) {
    e.preventDefault();
    if (e.submitter.classList.contains("form__btn-ok")) {
      if (this._validInputs()) {
        const workoutIndex = this.#workouts.findIndex(
          (workout) => workout.id === this.#lastWorkoutClicked.dataset.id
        );
        const workoutObj = this.#workouts[workoutIndex];
        console.log(workoutObj, workoutIndex);
        if (inputType.value !== workoutObj.type) {
          if (inputType.value === "running") {
            this.#workouts[workoutIndex] = new Running(
              +inputDistance.value,
              +inputDuration.value,
              +inputCadence.value,
              workoutObj.point
            );
          } else {
            this.#workouts[workoutIndex] = new Cycling(
              +inputDistance.value,
              +inputDuration.value,
              +inputElevation.value,
              workoutObj.point
            );
          }
          this.#workouts[workoutIndex].date = workoutObj.date;
          this.#workouts[workoutIndex].id = workoutObj.id;

          const layer = this.#drawnItems.getLayer(
            this.#workouts[workoutIndex].point.id
          );
          console.log(this.#workouts[workoutIndex]);
          layer.closePopup();
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
      }
    } else {
      this._showWorkoutList();
      this._hideForm();
      this.#currentForm = undefined;
    }
  }

  _deleteWorkout(workoutEl) {
    const workoutIndex = this.#workouts.findIndex(
      (w) => w.id === workoutEl.dataset.id
    );
    this.#drawnItems.removeLayer(this.#workouts[workoutIndex].point.id);
    this.#workouts.splice(workoutIndex, 1);
    workoutEl.remove();
    this._setLocalStorageWorkout();
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

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        "";

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

  _renderWorkoutMarker(layer, workout) {
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
        `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}`
      )
      .openPopup();
  }

  _deleteWorkoutList() {
    document.querySelectorAll(".workouts li").forEach((l) => l.remove());
  }

  _insertWorkout(selector, pos, workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <div class="workout__popup hidden">
          <p class="edit">Edit</p>
          <p class="delete">Delete</p>
          <span class="workout__close">x</span>
        </div>
        <span class="workout__edit">...</span>
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
           <span class="workout__icon">${
             workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"
           }</span> 
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === "running")
      html += `
        <div class="workout__details">
           <span class="workout__icon">⚡️</span> 
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
           <span class="workout__icon">🦶🏼</span> 
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;

    if (workout.type === "cycling")
      html += `
        <div class="workout__details">
           <span class="workout__icon">⚡️</span> 
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;

    selector.insertAdjacentHTML(pos, html);
  }
  _moveToPopup(workoutEl) {
    const workout = this.#workouts.find(
      (work) => work.id === workoutEl.dataset.id
    );

    const [lng, lat] = workout.point.geometry.coordinates;
    this.#map.setView([lat, lng], this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorageWorkout() {
    localStorage.setItem("workouts", JSON.stringify(this.#workouts));
  }
  _setLocalStorageDrawlayer() {
    localStorage.setItem("drawlayers", JSON.stringify(this.#drawlayers));
  }

  _getLocalStorageDrawlayers() {
    const drawlayersData = JSON.parse(localStorage.getItem("drawlayers"));
    const drawOptions = {
      shapeOptions: {
        color: "red",
        weight: 5,
        opacity: 1,
      },
    };

    if (!drawlayersData) return;

    drawlayersData.forEach((draw) => {
      L.geoJson(draw, {
        onEachFeature: function (feature, layer) {
          this.#drawnItems.addLayer(layer);
          draw.id = this.#drawnItems.getLayerId(layer);
          this.#drawlayers.push(draw);
        }.bind(this),
        style: function (feature) {
          return drawOptions.shapeOptions;
        },
      });
    });
  }

  _getLocalStorageWorkouts() {
    const workoutsData = JSON.parse(localStorage.getItem("workouts"));
    let workout;
    if (!workoutsData) return;

    workoutsData.forEach((work) => {
      L.geoJson(work.point, {
        onEachFeature: function (feature, layer) {
          this.#drawnItems.addLayer(layer);
          work.point.id = this.#drawnItems.getLayerId(layer);
          if (work.type === "running")
            workout = new Running(
              work.distance,
              work.duration,
              work.cadence,
              work.point
            );

          if (work.type === "cycling")
            workout = new Cycling(
              work.distance,
              work.duration,
              work.elevationGain,
              work.point
            );
          this.#workouts.push(workout);
          this._renderWorkoutMarker(layer, workout);
          this._insertWorkout(form, "afterend", workout);
        }.bind(this),
      });
    });
  }

  reset() {
    localStorage.removeItem("workouts");
    localStorage.removeItem("drawlayers");
    location.reload();
  }

  removeLayer(id) {
    this.#drawnItems.removeLayer(id);
  }

  eachLayerId() {
    this.#drawnItems.eachLayer(function (l) {
      console.log(this.#drawnItems.getLayerId(l));
    });
  }

  get drawnitems() {
    return this.#drawnItems;
  }
  get layerIds() {
    return this.#drawnItems.getLayers();
  }
  get workouts() {
    return this.#workouts;
  }
  get drawlayers() {
    return this.#drawlayers;
  }
}

const app = new App();
