import Map from 'ol/Map';

export class MeasurementStore {
    measurements: [];
    measurementsById: {};
    measurementsByOwner: {};
    map: Map;

    constructor(map: Map) {
      this.map = map;
    }

    getByOwner(userId) {
      return this.measurementsByOwner[userId] || [];
    }

    getById(id) {
      return this.measurementsById[id] || [];
    }
}
