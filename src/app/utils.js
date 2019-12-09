export function getLargestAmount (collection) {
  return Object.entries(collection).reduce((prev, [item, amount]) => {
    if (amount > prev.amount) {
      prev = {
        item,
        amount
      }
    }
    return prev
  }, {
    item: null,
    amount: -1
  })
}

export function calculateStats (features) {
  let stats = {
    iphones: 0,
    androids: 0,
    mostUsedDevice: null,
    mostReportedFU: 0,
    avgFU: 0,
    mostActiveUser: null,
    eowAu: 0,
    eowGlobal: 0
  }
  let users = {}
  let fuValues = {}
  let devices = {}
  // collect and aggregate
  stats = features.reduce((stats, feature) => {
    const properties = feature.getProperties()
    // ~~ to coerce NaN/undefined to 0
    // Only count users from EOW AU
    if (properties.application === 'australia') {
      users[properties.user_n_code] = ~~users[properties.user_n_code] + 1
    }

    fuValues[properties.fu_value] = ~~fuValues[properties.fu_value] + 1
    devices[properties.device_model] = ~~devices[properties.device_model] + 1
    stats[properties.device_platform === 'iOS' ? 'iphones' : 'androids'] += 1
    stats[properties.application === 'australia' ? 'eowAu' : 'eowGlobal'] += 1
    return stats
  }, stats)

  const mostReportedFU = getLargestAmount(fuValues)
  const mostUsedDevice = getLargestAmount(devices)
  const mostActiveUser = getLargestAmount(Object.assign({}, users, {
    null: -2
  }))

  const avgFU = Object.entries(fuValues).reduce((prev, [fu, amount]) => {
    return prev + (fu * amount)
  }, 0) / features.length

  return Object.assign({}, stats, {
    mostReportedFU,
    avgFU,
    mostUsedDevice,
    mostActiveUser
  })
}

export function printStats (stats, userStore) {
  return `
    <div>
      <ul>
        <li>
            <span class="stats-value" class="pieChart"></span>
        </li>
        <li>
        <span class="stats-value">${stats.iphones}</span>
        <span class="stats-label">iPhones</span>
        </li>
        <li>
        <span class="stats-value">${stats.androids}</span>
        <span class="stats-label">Androids</span>
        </li>
        <li>
        <span class="stats-value">${stats.mostUsedDevice.item ? `${stats.mostUsedDevice.item}<span class="stat-extra">@${stats.mostUsedDevice.amount}</span>` : 'N/A'}</span>
        <span class="stats-label">Most Used Device</span>
        </li>
        <li>
        <span class="stats-value">${stats.mostReportedFU.item ? `${stats.mostReportedFU.item}<span class="stat-extra">@${stats.mostReportedFU.amount}</span>` : 'N/A'}</span>
        <span class="stats-label">Most Reported FU</span>
        </li>
        <li>
        <span class="stats-value">${Number(stats.avgFU).toFixed(2)}</span>
        <span class="stats-label">Average FU</span>
        </li>
        <li>
        
        <span class="stats-value">${stats.mostActiveUser.item ? `${userStore.getUserById(stats.mostActiveUser.item).nickname}<span class="stat-extra">@${stats.mostActiveUser.amount}</span>` : 'N/A'}</span>
        <span class="stats-label">Most Active User</span>
        </li>
        <li>
        <span class="stats-value">${stats.eowAu}</span>
        <span class="stats-label">EyeOnWater Australia</span>
        </li>
        <li>
        <span class="stats-value">${stats.eowGlobal}</span>
        <span class="stats-label">EyeOnWater: Worldwide</span>
        </li>
      </ul>
      <div style="clear:both"></div>
    </div>
  `
}
