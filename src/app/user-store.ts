import orderBy from 'lodash/orderBy';
import keyBy from 'lodash/keyBy';

export class UserStore {
  htmlDocument: Document;
  users: [];
  userById: {};

  constructor(htmlDocument: Document) {
    this.htmlDocument = htmlDocument;
  }

  init() {
    const USER_SERVICE = 'https://www.eyeonwater.org/api/users';

    async function loadUsers() {
      // TODO I'm curious as to if this is correct under Angular
      const response = await window.fetch(USER_SERVICE);
      const {
        results: {
          users
        }
      } = await response.json();
      return users;
    }

// Load users
    loadUsers().then((users) => {
      this.users = users;
      this.userById = keyBy(this.users, 'id');
      this.renderUsers(this.users);
    });
  }
  getUserById(userId) {
    return this.userById[userId] || [];
  }

  clearSelectedUser() {
    this.htmlDocument.querySelectorAll('.user-list .item').forEach(item => {
      item.classList.remove('selectedUser', 'box-shadow');
    });
  }

  renderUsers(users, n = 10) {
    const userList = orderBy(users, ['photo_count', 'points'], ['desc', 'desc']).slice(0, n).map(user => {
      return `
            <li class="item" data-user="${user.id}">
              <div>
                <img  class="icon-thumb" src="https://eyeonwater.org/grfx/${user.icon}">
              </div>
              <div>
                <div class="item-nickname">${user.nickname}</div>
                <div class="item-photo-count">(${user.photo_count} photos)</div>
                <div class="item-points">${user.points} points (level ${user.level})</div>
              </div>
            </li>`;
    });

    this.htmlDocument.querySelector('.user-list ul').innerHTML = userList.join('\n');
  }
}
