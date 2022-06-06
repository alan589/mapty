'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
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
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
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
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    // this.type = 'cycling';
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
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const sortBtn = document.querySelector('.sort-btn');
const sortOption = document.querySelector('#sort-select');
const deleteAllBtn = document.querySelector('.delete-btn');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #currentForm;
  #lastWorkoutClicked;
  #sortedAsc;
  #drawlines = [];

  constructor() {
    // Get user's position
    this._getPosition();

    // Attach event handlers
    deleteAllBtn.addEventListener('click', this.reset);

    sortBtn.addEventListener(
      'click',
      function (e) {
        if (!this.#sortedAsc) {
          if (sortOption.value === 'distance')
            this.#workouts.sort((a, b) => a.distance - b.distance);
          if (sortOption.value === 'type')
            this.#workouts.sort((a, b) => (a.type < b.type ? 1 : -1));
          if (sortOption.value === 'date')
            this.#workouts.sort((a, b) => a.date - b.date);
          if (sortOption.value === 'duration')
            this.#workouts.sort((a, b) => a.duration - b.duration);
          this.#sortedAsc = true;
          sortBtn.innerHTML = 'Sort &downarrow;';
        } else {
          if (sortOption.value === 'distance')
            this.#workouts.sort((a, b) => b.distance - a.distance);
          if (sortOption.value === 'type')
            this.#workouts.sort((a, b) => (a.type > b.type ? 1 : -1));
          if (sortOption.value === 'date')
            this.#workouts.sort((a, b) => b.date - a.date);
          if (sortOption.value === 'duration')
            this.#workouts.sort((a, b) => b.duration - a.duration);
          this.#sortedAsc = false;
          sortBtn.innerHTML = 'Sort &uparrow;';
        }

        this._deleteWorkoutList();
        this.#workouts.forEach(w =>
          this._insertWorkout(containerWorkouts, 'beforeend', w)
        );
      }.bind(this)
    );

    form.addEventListener(
      'submit',
      function (e) {
        if (
          'newWorkout' === this.#currentForm ||
          undefined === this.#currentForm
        )
          this._newWorkout(e);
        else if ('editWorkout' === this.#currentForm) this._editWorkout(e);
      }.bind(this)
    );

    inputType.addEventListener('change', this._toggleElevationField);

    containerWorkouts.addEventListener(
      'click',
      function (e) {
        if (!this.#map) return;

        const workoutEl = e.target.closest('.workout');
        if (!workoutEl) return;

        if (e.target.classList.contains('workout__edit')) this._openEdit(e);
        else if (e.target.classList.contains('workout__close'))
          this._closeEdit(e);
        else if (e.target.closest('.workout__popup')) {
          this.#lastWorkoutClicked = workoutEl;
          if(e.target.classList.contains('edit')) this._displayEditForm(workoutEl);
          if(e.target.classList.contains('delete')) this._deleteWorkout(workoutEl);
        } else {
          this._hidePopups();
          this._moveToPopup(workoutEl);
        }
      }.bind(this)
    );
  }
  _deleteWorkout(workoutEl){
    this.#workouts.splice(
              this.#workouts.findIndex(w => w.id === workoutEl.dataset.id),
              1
            );
    workoutEl.remove();
  }

  _displayEditForm(workoutEl){
    if (workoutEl.classList.contains('workout--cycling')) {
            inputType.value = 'cycling';
            inputElevation
              .closest('.form__row')
              .classList.remove('form__row--hidden');
            inputCadence
              .closest('.form__row')
              .classList.add('form__row--hidden');
    } 
    else {
            inputType.value = 'running';
            inputElevation
              .closest('.form__row')
              .classList.add('form__row--hidden');
            inputCadence
              .closest('.form__row')
              .classList.remove('form__row--hidden');
    }
    this.#currentForm = 'editWorkout';
    this._hidePopups();
    this._showForm();
    this._hiddenWorkoutList();
  }

  _hiddenWorkoutList() {
    document
      .querySelectorAll('.workouts li')
      .forEach(li => li.classList.add('hidden-workouts'));
  }
  _showWorkoutList() {
    document
      .querySelectorAll('.workouts li')
      .forEach(li => li.classList.remove('hidden-workouts'));
  }

  _editWorkout(e) {
    e.preventDefault();
    if (e.submitter.classList.contains('form__btn-ok')) {
      if (this._validInputs()) {
        const workoutIndex = this.#workouts.findIndex(
          workout => workout.id === this.#lastWorkoutClicked.dataset.id
        );
        const workoutObj = this.#workouts[workoutIndex];
        if (inputType.value !== workoutObj.type) {
          if (inputType.value === 'running') {
            this.#workouts[workoutIndex] = new Running(
              workoutObj.coords,
              +inputDistance.value,
              +inputDuration.value,
              +inputCadence.value
            );
          } else {
            this.#workouts[workoutIndex] = new Cycling(
              workoutObj.coords,
              +inputDistance.value,
              +inputDuration.value,
              +inputElevation.value
            );
          }
          this.#workouts[workoutIndex].date = workoutObj.date;
          this.#workouts[workoutIndex].id = workoutObj.id;
        } else {
          workoutObj.distance = +inputDistance.value;
          workoutObj.duration = +inputDuration.value;

          if (workoutObj.type === 'running') {
            workoutObj.cadence = +inputCadence.value;
            workoutObj.calcPace();
          } else {
            workoutObj.elevationGain = +inputElevation.value;
            workoutObj.calcSpeed();
          }
        }

        this._insertWorkout(
          this.#lastWorkoutClicked,
          'afterend',
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
  _closeEdit(e) {
    this._hidePopups();
  }

  _openEdit(e) {
    this._hidePopups();
    e.target.previousElementSibling.classList.remove('hidden');
    e.target.previousElementSibling.style.right = '0';
  }
  _hidePopups() {
    document.querySelectorAll('.workout__popup').forEach(popup => {
      popup.classList.add('hidden');
      popup.style.right = '-100px';
    });
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );

    // this._loadMap({})
  }

  get workouts() {
    return this.#workouts;
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    // const latitude  = -22.8655104;
    // const longitude  = -43.4274304;

    console.log(`https://www.google.pt/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];
    const drawOptions = {shapeOptions: {
            color: 'red',
            weight: 5,
            opacity: 1,
          }};

  
    const osm = L.tileLayer(
      'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    );

    const google = L.tileLayer(
            'http://www.google.cn/maps/vt?lyrs=s@189&gl=cn&x={x}&y={y}&z={z}',
            {
              attribution: 'google',
            }
          );

    // LEAFTLET DRAW
    const data = JSON.parse(localStorage.getItem('drawlines'));
    if (data) data.forEach(d => this.#drawlines.push(d));

    const drawnItems = new L.FeatureGroup();

    L.geoJson(data, {
      onEachFeature: function (feature, layer) {
        drawnItems.addLayer(layer);
      },
      style: function (feature) {
        return drawOptions.shapeOptions;
      },
    });

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
    this.#map.addLayer(drawnItems);

    L.control
      .layers(
        {
          google: google.addTo(this.#map),
          osm: osm.addTo(this.#map)
        },
        {},
        { position: 'topright', collapsed: false }
      )
      .addTo(this.#map);

    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawnItems,
        edit: true,
      },
      draw: {
        polyline: drawOptions,
        polygon: drawOptions,
        rectangle: drawOptions,
        marker: true,
        circle: false
      },
    });

    this.#map.addControl(drawControl);
    // drawControl.options.draw.polyline.shapeOptions.color = '#0000FF';

    document
      .querySelector(
        '#map > div.leaflet-control-container > div.leaflet-top.leaflet-right > div > section'
      )
      .insertAdjacentHTML(
        'afterbegin',
        `<label><div><span>Maps</span></div></label>`
      );


    this.#map.on('draw:drawstart', (e) => {
      this.#currentForm = 'toolbarClicked'
    });
    this.#map.on('draw:drawstop', (e) => {
      
        this.#currentForm = undefined
    });
    this.#map.on('draw:editstart', () => (this.#currentForm = 'toolbarClicked'));
    this.#map.on('draw:editstop ', () => (this.#currentForm = undefined));
    this.#map.on('draw:deletestart', () => (this.#currentForm = 'toolbarClicked'));
    this.#map.on('draw:deletestop', () => (this.#currentForm = undefined));

    this.#map.on(
      L.Draw.Event.CREATED,
      function (event) {
        const layer = event.layer;
        drawnItems.addLayer(layer);

        if(event.layerType === "marker"){
          console.log(event.layer.getLatLng())
          this.#mapEvent = event;
          this.#currentForm = 'newWorkout';
          this._hidePopups();
          this._showForm();
        }
          
        const layerJSON = layer.toGeoJSON();
        layerJSON.id = (Date.now() + '').slice(-10);
        this.#drawlines.push(layerJSON);
        localStorage.setItem('drawlines', JSON.stringify(this.#drawlines));
      }.bind(this)
    );

    this.#map.on(
      L.Draw.Event.EDITED,
      function (event) {
        const layers = event.layers;
        layers.eachLayer(
          function (layer) {
            drawnItems.addLayer(layer);
            const layerJSON = layer.toGeoJSON();
            const indexLayer = this.#drawlines.findIndex(
              l => l.id === layerJSON.id
            );
            this.#drawlines[indexLayer] = layerJSON;

            localStorage.setItem('drawlines', JSON.stringify(this.#drawlines));
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
            this.#drawlines.splice(
              this.#drawlines.findIndex(d => d.id === layerJSON.id),
              1
            );
            localStorage.setItem('drawlines', JSON.stringify(this.#drawlines));
          }.bind(this)
        );
      }.bind(this)
    );

    // Handling clicks on map
    // this.#map.on(
    //   'click',
    //   function (e) {
    //     if (
    //       !(
    //         this.#currentForm === 'editWorkout' ||
    //         this.#currentForm === 'toolbarClicked'
    //       )
    //     ) {
    //       this.#mapEvent = e;
    //       this.#currentForm = 'newWorkout';
    //       this._hidePopups();
    //       this._showForm();
    //     }
    //   }.bind(this)
    // );

    // Get data from local storage
    this._getLocalStorage();
  }

  _showForm() {
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 300);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _displayInvalidMsg(){
    form.style.transition =  "none";
    form.classList.add('invalid-input')
        setTimeout(() => {
          form.classList.remove('invalid-input')  
          setTimeout(() => (form.style.transition =  "all 0.5s, transform 1ms"), 300);
        }, 2500)
  }

  _validInputs() {
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    // Check if data is valid
    if (type === 'running') {
      const cadence = +inputCadence.value;
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        this._displayInvalidMsg();
        return false;
      }
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
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
  _newWorkout(e) {
    e.preventDefault();

    if (e.submitter.classList.contains('form__btn-ok')) {
      const { lat, lng } = this.#mapEvent.layer.getLatLng();
      let workout;

      // If workout running, create running object

      if (!this._validInputs()) {
        return;
      }

      if (inputType.value === 'running')
        workout = new Running(
          [lat, lng],
          +inputDistance.value,
          +inputDuration.value,
          +inputCadence.value
        );

      // If workout cycling, create cycling object
      if (inputType.value === 'cycling')
        workout = new Cycling(
          [lat, lng],
          +inputDistance.value,
          +inputDuration.value,
          +inputElevation.value
        );

      // Add new object to workout array
      this.#workouts.push(workout);

      // Render workout on map as marker
      this._renderWorkoutMarker2(this.#mapEvent.layer, workout);

      // Render workout on list
      this._insertWorkout(form, 'afterend', workout);

      // Set local storage to all workouts
      this._setLocalStorage();
    }

    // Hide form + clear input fields
    this._hideForm();
  }

  _renderWorkoutMarker2(layer, workout){
            layer.bindPopup(
            L.popup({
              maxWidth: 250,
              minWidth: 100,
              autoClose: false,
              closeOnClick: false,
              className: `${workout.type}-popup`,
            })
          )
          .setPopupContent(
            `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
          )
          .openPopup();
  }



  // GUARDA O L.MARKER EM UMA ESTRUTURA DE DADOS ASSOCIADO AOS OBJETOS
  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
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
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }
  _deleteWorkoutList() {
    document.querySelectorAll('.workouts li').forEach(l => l.remove());
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
          <!-- <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span> -->
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <!-- <span class="workout__icon">⏱</span> -->
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <!-- <span class="workout__icon">⚡️</span> -->
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <!-- <span class="workout__icon">🦶🏼</span> -->
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <!-- <span class="workout__icon">⚡️</span> -->
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <!-- <span class="workout__icon">⛰</span> -->
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;

    selector.insertAdjacentHTML(pos, html);
  }
  _moveToPopup(workoutEl) {
    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    localStorage.removeItem('drawlines');
    location.reload();
  }
}

const app = new App();
