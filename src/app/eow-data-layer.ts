import Map from 'ol/Map';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import CircleStyle from 'ol/style/Circle';
import {
  Style,
  Stroke,
  Fill
} from 'ol/style';
import debounce from 'lodash/debounce';

import {
  printStats,
  calculateStats,
} from './utils';
import colors from './colors.json';
import {UserStore} from './user-store';
import {MeasurementStore} from './measurement-store';

const WFS_URL = 'https://geoservice.maris.nl/wms/project/eyeonwater_australia?service=WFS'
  + '&version=1.0.0&request=GetFeature&typeName=eow_australia&maxFeatures=5000&outputFormat=application%2Fjson';

export class EowDataLayer {
  map: Map;
  htmlDocument: Document;
  userStore: UserStore;
  measurementStore: MeasurementStore;
  allDataSource: any;
  dataLayer: any;
  styleCache = {};

  init(map: Map, htmlDocument: Document, userStore: UserStore, measurementStore: MeasurementStore) {
    this.map = map;
    this.htmlDocument = htmlDocument;
    this.userStore = userStore;
    this.measurementStore = measurementStore;
    this.allDataSource = new VectorSource({
      format: new GeoJSON(),
      url: WFS_URL
    });

    const basicStyle = (feature, resolution) => {
      const fuValue = feature.get('fu_value');
      const styleKey = `${fuValue}_${resolution}`;
      // Avoid some unnecessary computation
      if (this.styleCache[styleKey]) {
        return this.styleCache[styleKey];
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

      this.styleCache[styleKey] = new Style(styleOptions);
      return this.styleCache[styleKey];
    };
    this.dataLayer = new VectorLayer({
      source: this.allDataSource,
      style: basicStyle
    });
    this.dataLayer.set('name', 'EOW Data');

    this.map.addLayer(this.dataLayer);
  }

  setupEventHandlers() {
    this.dataLayer.on('change', debounce(({target}) => {
      // Populate datalayer
      const element = this.htmlDocument.querySelector('.sub-header-stats') as HTMLElement;
      element.innerHTML = printStats(calculateStats(target.getSource().getFeatures()), this.userStore);
    }, 200));


    this.allDataSource.on('change', this.measurementStore.initialLoadMeasurements.bind(this.measurementStore));
  }
}
