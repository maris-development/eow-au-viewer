import orderBy from 'lodash/orderBy'
import {
  DateTime
} from 'luxon';
import Map from 'ol/Map';
import VectorSource from 'ol/source/Vector';
import keyBy from 'lodash/keyBy';
import groupBy from 'lodash/groupBy';

export class MeasurementStore {
    measurements: [];
    measurementsById: {};
    measurementsByOwner: {};
    map: Map;
    dataLayer: any;
    allDataSource: any;

  init(map: Map, dataLayer: any, allDataSource: any) {
      this.map = map;
      this.dataLayer = dataLayer;
      this.allDataSource = allDataSource;
    }

    getByOwner(userId) {
      return this.measurementsByOwner[userId] || [];
    }

    getById(id) {
      return this.measurementsById[id] || [];
    }

    setupEventHandling() {
    }

  clearFilter() {
    this.recentMeasurements(this.measurements);
  }


  private recentMeasurements(measurements, n = 20) {
    const userList = orderBy(measurements, [(f) => (new Date(f.get('date_photo'))).getTime()], ['desc']).slice(0, n).map((measurement) => {
      const prettyDate = DateTime.fromISO(measurement.get('date_photo')).toLocaleString(DateTime.DATE_FULL);

      const itemTemplate = ` <li class="item measurement-item" data-coordinate="${measurement.getGeometry().getCoordinates()}"` +
                          `data-key="${measurement.get('n_code')}"><img src="https://eyeonwater.org/grfx/icons/small/` +
                          `${measurement.get('fu_value')}.png"> ${prettyDate}</li>`;
      return itemTemplate;
    });

    document.querySelector('.measurement-list ul').innerHTML = userList.join('\n')
  }

  initialLoadMeasurements(event) {
    const source = event.target;
    if (!source.loading) {
      const features = this.allDataSource.getFeatures();
      // Store the measurements in easy to access data structure
      this.measurements = features;
      this.measurementsById = keyBy(features, f => f.get('n_code'));
      this.measurementsByOwner = groupBy(features, f => f.get('user_n_code'));

      this.recentMeasurements(this.measurements);
      this.allDataSource.un('change', this.initialLoadMeasurements);
    }
  }

  showMeasurements(userId = null) {
    const newSource = new VectorSource();
    const selection = this.getByOwner(userId);
    if (!selection.length) {
      return false;
    }
    newSource.addFeatures(selection);
    this.map.getView().fit(newSource.getExtent(), {
      size: this.map.getSize(),
      padding: [100, 100, 100, 100],
      nearest: false,
      duration: 1300
    });
    this.dataLayer.setSource(newSource);
    this.recentMeasurements(selection);
    return true;
  }


}
