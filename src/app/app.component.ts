import {Component, OnInit, Inject, AfterViewInit} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import debounce from 'lodash/debounce';
import Map from 'ol/Map';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
import View from 'ol/View';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import {fromLonLat} from 'ol/proj';

import GeoJSON from 'ol/format/GeoJSON';
import CircleStyle from 'ol/style/Circle';
import {
  Style,
  Stroke,
  Fill
} from 'ol/style';

import {
  colors,
  printStats,
  calculateStats,
} from './utils';
import {HttpClient} from '@angular/common/http';
import {PieChart} from './pie-chart';
import {Popup} from './popup';
import {Layers} from './layers';
import {MeasurementStore} from './measurement-store';
import {UserStore} from './users';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  title = 'ng-eow';
  map: Map;
  popupObject: any;
  measurementStore: MeasurementStore;
  userStore: UserStore;
  dataLayer: any;
  allDataSource: any;
  pieChart: any;
  layers: Layers;
  htmlDocument: Document;

  constructor(@Inject(DOCUMENT) private document: Document, private http: HttpClient) {
    this.htmlDocument = document;
    this.pieChart = new PieChart();
    // Fast datastructures to query the data
    // this.userStore = {
    //   users: [],
    //   userById: {},
    //   getUserById(userId) {
    //     return this.userById[userId] || [];
    //   }
    // };
    this.userStore = new UserStore(this.document);
    this.popupObject = new Popup(this.document, this.pieChart, this.userStore);
    this.layers = new Layers(this.document, this.http);
    this.measurementStore = new MeasurementStore();
  }

  ngOnInit() {
    this.initMap();
    this.popupObject.init(this.map);
    this.measurementStore.init(this.map, this.dataLayer, this.allDataSource);
    this.layers.addLayers(this.map);
    this.userStore.init();

    this.setupEventHandlers();
  }

  private initMap() {
    const WFS_URL = 'https://geoservice.maris.nl/wms/project/eyeonwater_australia?service=WFS'
      + '&version=1.0.0&request=GetFeature&typeName=eow_australia&maxFeatures=5000&outputFormat=application%2Fjson';
    const styleCache = {};

    this.allDataSource = new VectorSource({
      format: new GeoJSON(),
      url: WFS_URL
    });

// Style Features using ..... FU values (called for each feature on every render call)
    const basicStyle = (feature, resolution) => {
      const fuValue = feature.get('fu_value');
      const styleKey = `${fuValue}_${resolution}`;
      // Avoid some unnecessary computation
      if (styleCache[styleKey]) {
        return styleCache[styleKey];
      }
      feature.set('visible', true);
      const styleOptions = {
        image: new CircleStyle({
          radius: this.map.getView().getZoom() * Math.log2(5),
          stroke: new Stroke({
            color: 'white'
          }),
          fill: new Fill({
            color: colors[fuValue]
          })
        })
      };

      styleCache[styleKey] = new Style(styleOptions);
      return styleCache[styleKey];
    };
    this.dataLayer = new VectorLayer({
      source: this.allDataSource,
      style: basicStyle
    });
    this.dataLayer.set('name', 'EOW Data');

    this.dataLayer.on('change', debounce(({target}) => {
      // Populate datalayer
      const element = this.document.querySelector('.sub-header-stats') as HTMLElement;
      element.innerHTML = printStats(calculateStats(target.getSource().getFeatures()), this.userStore);
    }, 200));
    const mainMap = new TileLayer({
      source: new OSM()
    });
    mainMap.set('name', 'Main map');

    this.map = new Map({
      target: 'map',
      layers: [
        mainMap,
        this.dataLayer
      ],
      view: new View({
        center: fromLonLat([133.945313, -26.431228]),
        zoom: 4
      }),
      controls: [],
    });

    this.map.on('click', (evt) => {
      const {
        pixel,
        coordinate
      } = evt;

      const features = [];

      this.map.forEachFeatureAtPixel(pixel, (feature) => {
        features.push(feature);
      });

      if (features.length) {
        console.log(`Clicked on map at: ${JSON.stringify(coordinate)}`);
        this.popupObject.draw(features, coordinate);
      }
    });
  }

  private setupEventHandlers() {
    // Pull tabs of Most Active Users and Recent Measurements
    this.document.querySelectorAll('.pull-tab').forEach(i => i.addEventListener('click', (event: Event) => {
      const element = (event.target as HTMLElement).closest('.panel');
      element.classList.toggle('pulled');
    }));
    // User List
    document.querySelector('.user-list').addEventListener('click', (event) => {
      const element = (event.target as HTMLElement).closest('.item');
      const userId = element.getAttribute('data-user');

      if (this.measurementStore.showMeasurements(userId)) {
        this.userStore.clearSelectedUser();
        element.classList.add('selectedUser', 'box-shadow');
        this.toggleFilterButton(true);
      }
    }, true);

    // Measurement List
    document.querySelector('.measurement-list').addEventListener('click', (event) => {
      const element = (event.target as HTMLElement).closest('.item');
      if (!element) {
        return;
      }

      const coordinate = element.getAttribute('data-coordinate').split(',');
      const id = element.getAttribute('data-key');
      const view = this.map.getView();
      view.cancelAnimations();
      view.animate({
        center: coordinate,
        zoom: 8,
        duration: 1300
      });
      const features = [this.measurementStore.getById(id)];
      this.popupObject.draw(features, coordinate);
    }, true);

    this.document.getElementById('clearFilterButton').addEventListener('click', (event) => {
      this.clearFilter();
    });

    this.allDataSource.on('change', this.measurementStore.initialLoadMeasurements.bind(this.measurementStore));
  }

  private clearFilter() {
    this.dataLayer.setSource(this.allDataSource);
    this.userStore.clearSelectedUser();
    this.measurementStore.clearFilter();
    this.map.getView().fit(this.dataLayer.getSource().getExtent(), {duration: 1300});
    this.toggleFilterButton(false);
  }
  //
  private toggleFilterButton(state = false) {
    const element = this.document.getElementById('clearFilterButton');
    element.classList.toggle('hidden', !state);
  }
}
