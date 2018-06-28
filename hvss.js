"use strict";

/**
 * hvScriptSet
 * Version: 1.0.11
 * Author: Человек-Шаман
 * license: MIT
 *
 * Что нового:
 * 1. Имя маски отображается в цитировании и при обращении.
 */

class AddMask {
  constructor(opt) {
    this.setSchema(opt);
    this.initMask = this.initMask.bind(this);
    this.setMasks = this.setMasks.bind(this);

    document.addEventListener('DOMContentLoaded', this.initMask);
  }

  setSchema(opt) {
    this.opt = {
      userFields: ['pa-author', 'pa-title', 'pa-avatar', 'pa-fld1', 'pa-reg', 'pa-posts', 'pa-respect', 'pa-positive', 'pa-awards', 'pa-gifts'],
      defaultAvatar: 'http://i.imgur.com/bQuC3S1.png',
      buttonImage: 'http://i.imgur.com/ONu0llO.png',
      showPreview: true,
      ...opt
    }
    this.schema = {
      'author': {
        title: 'Ник',
        description: 'Только текст',
        tag: 'nick,nic',
        class: 'pa-author',
        type: 'author'
      },
      'title': {
        title: 'Статус',
        description: 'Только текст',
        tag: 'status,sta',
        class: 'pa-title',
        type: 'text'
      },
      'avatar': {
        title: 'Аватар',
        description: 'Прямая ссылка на картинку формата jpg, gif или png',
        tag: 'icon,ava',
        class: 'pa-avatar',
        type: 'avatar'
      },
      'signature': {
        title: 'Подпись',
        description: 'Принимает bb-коды, кроме таблицы',
        tag: 'sign,sgn',
        class: 'post-sig',
        type: 'signature'
      },
      ...opt.changeList
    }
    this.tagList = Object.keys(this.schema)
      .reduce((result, item) => {
        const temp = {};
        this.schema[item].tag.replace(' ', '').split(',').forEach(tag => temp[tag] = item);
        return {
          ...result,
          ...temp
        }
      }, {});
  }

  initMask() {
    if (FORUM && FORUM.editor) {
      this.initDialog();
    }

    this.parsePosts();
    if (FORUM && FORUM.topic) {
      this.applyMask();
    }
  }

  //

  parsePosts() {
    this.maskedPosts = {};
    this.authorsId = [];

    const posts = document.querySelectorAll('.post-content');
    posts.forEach(postContent => {
      const postId = postContent.id.split('-')[0];
      const text = this.getPostHtmlWithoutCodeboxes(postContent.innerHTML);
      const changes = [];
      const tags = [];

      Object.keys(this.tagList).forEach(tag => {
        const pattern = this.getTagPattern(tag);
        const matches = text.match(pattern);

        if (matches) {
          const clearPattern = new RegExp(`\\[(\\/?)${tag}\\]`, 'gmi');
          tags.push(tag);
          changes.push({
            type: this.tagList[tag],
            text: matches[0].replace(clearPattern, '')
          });
        }
      });

      if (changes.length) {
        // clear post from mask tags
        this.hideMaskTags(postContent, tags);

        if (!postId) return;
        const postElement = document.getElementById(postId);
        const userId = this.getUserIdFromPost(postElement);
        this.maskedPosts[postId] = {
          post: postElement,
          profile: postElement.querySelector('.post-author ul'),
          userId,
          postId,
          changes
        };
        if (!this.authorsId.includes(userId) && userId !== '1') this.authorsId.push(userId);
      }
    });
  }

  applyMask() {
    this.authors = {
      '1': {
        'userId': '1',
        'username': 'Guest',
        'groupId': '3',
        'groupTitle': 'Гость'
      }
    };

    this.getUsersInfo().then(this.setMasks);

  }

  initDialog() {
    console.log('initDialog');
  }

  // functions

  setMasks() {
    Object.values(this.maskedPosts).forEach(post => {
      const authorPermissions = this.getAuthorPermissions(post.userId);
      const profile = post.post.querySelector('.post-author ul');
      post.changes.forEach(change => {

        // common mask: avatar only
        if (!authorPermissions.common) {
          return;
        }

        if (change.type === 'avatar') {
          this.changePostAvatar(post, change.text);
          return;
        }

        // extended mask
        if (!authorPermissions.extended) {
          return;
        }

        if (change.type === 'signature') {
          // this.changePostSignature(post, change.text);
          return;
        }

        if (!post.profile.querySelector(`.${this.schema[change.type].class}`)) {
          this.insertProfileField(post.profile, this.schema[change.type].class);
        }
        switch (this.schema[change.type].type) {
          case 'author':
            this.changePostAuthor(post, change.text);
            break;
          case 'html':
            this.changePostHtml(post, change);
            break;
          case 'bbcode':
            // this.changePostBBCode(post, change);
            break;
          case 'text':
          default:
            // this.changePostText(post, change);
        }

      });
    });
  }

  hideMaskTags(post, tags) {
    const delimiter = '|(:-:)|';
    const signDelimiter = '{{!!!}}';
    const codeBoxes = post.innerHTML.match(this.getCodeBoxPattern(), delimiter) || [];
    const signature = post.innerHTML.match(this.getSignaturePattern(), signDelimiter) || '';
    let text = this.getPostHtmlWithoutCodeboxes(post.innerHTML, delimiter)
      .replace(this.getSignaturePattern(), '');

    tags.forEach(tag => {
      text = text.replace(this.getTagPattern(tag), '');
    });

    codeBoxes.forEach(code => text = text.replace(delimiter, code));

    post.innerHTML = text.replace(signDelimiter, signature[0]);
  }

  insertProfileField(profile, field) {
    let prev;
    for (let i = this.opt.userFields.indexOf(field); i >= 0; --i) {
      if (profile.querySelector(`.${this.opt.userFields[i]}`)) {
        prev = this.opt.userFields[i];
        break;
      }
    }
    const el = prev ? profile.querySelector(`.${prev}`)
      : profile;
    const place = prev ? 'afterEnd' : 'beforeEnd';
    el.insertAdjacentHTML(
      place,
      `<li class="${field}"></div>`
    );
  }

  // changes

  changePostAvatar(post, url) {
    if (!this.checkImageUrl(url)) {
      // todo: сообщение юзеру о неисправной ссылке
      return;
    }

    const avatarEl = post.profile.querySelector('.pa-avatar img');
    if (avatarEl) {
      avatarEl.src = url;
      avatarEl.removeAttribute('width');
      avatarEl.removeAttribute('height');
    } else {
      const prev = this.opt.userFields[this.opt.userFields.indexOf('pa-avatar') - 1];
      const el = prev
        ? post.profile.querySelector(`.${prev}`)
        : post.profile;
      const place = prev
        ? 'afterEnd'
        : 'beforeEnd';
      el.insertAdjacentHTML(
        place,
        `<div class="pa-avatar"><img src="${url}"></div>`
      );
    }
  }

  changePostAuthor(post, name) {
    const author = post.profile.querySelector('.pa-author a')
      || post.profile.querySelector('.pa-author');
    const content = name.substring(0, 25)
    author.innerText = content;
    if (author.href && author.href.includes('javascript')) {
      author.href = `javascript:to('${content}')`;
    };
    if (post.post.querySelector('.pl-quote a')) {
      post.post.querySelector('.pl-quote a').href = `javascript:quote('${content}', ${post.postId.slice(1)})`
    }
  }

  changePostHtml(post, change) {
    const content = this.strToHtml(change.text);
    if (content === '') {
      const author = this.authors[post.userId];
      if (+UserID === +post.userId) {
        $.jGrowl(`Что-то не так с маской в вашем посте ${post.postId}. В ней найдены некорректные тэги. Маска не будет применена.`, { header: 'Ошибка скрипта маски', sticky: true });
        return;
      }
      if (GroupID === 1 || GroupID === 2) {
        $.jGrowl(`Что-то не так с маской юзера ${author.username} в посте ${post.postId}. В ней найдены некорректные тэги. Маска не будет применена.`, { header: 'Ошибка скрипта маски', sticky: true });
        return;
      }
    }
    if (content.length > 999) return;

    const field = post.profile.querySelector(`.${this.schema[change.type].class}`);
    field.innerHTML = content;
  }

  // requests

  async getUsersInfo() {
    const params = {
      async: false,
      url: '/api.php',
      data: {
        method: 'users.get',
        user_id: this.authorsId.join(',')
      }
    };

    const { response } = await $.ajax(params);

    if (!response) return;

    response.users.forEach(user => {
      this.authors[user.user_id] = {
        userId: user.user_id,
        username: user.username,
        groupId: user.group_id,
        groupTitle: user.group_title
      };
    });
  }

  // helpers

  getAuthorPermissions(userId) {
    const { groupId, groupTitle } = this.authors[userId];

    if (groupId === '1' || groupId === '2') {
      return {
        common: true,
        extended: true
      }
    }

    const forumName = this.getClearedForumName(FORUM.topic.forum_name);

    if (groupId === '3') {
      return {
        common: this.opt.guestAccess
          ? this.opt.guestAccess.includes(forumName)
          : false,
        extended: this.opt.guestAccess
          ? this.opt.guestAccess.includes(forumName)
          : false
      }
    }

    return {
      common: this.opt.forumAccess && this.opt.forumAccess[forumName]
        ? this.opt.forumAccess[forumName].includes(groupTitle)
        : true,
      extended: this.opt.forumAccessExtended && this.opt.forumAccessExtended[forumName]
        ? this.opt.forumAccessExtended[forumName].includes(groupTitle)
        : false
    };
  }

  getUserIdFromPost(post) {
    let userId = '1';
    if (UserID === 1) {
      const postUserNameLink = post.querySelector('.pa-author a');
      if (postUserNameLink && postUserNameLink.href.includes('/profile.php')) {
        userId = postUserNameLink.href.split('=')[1];
      }
    } else {
      const postProfileLinks = post.querySelector('.post-links');
      let postProfileUserLink = postProfileLinks.querySelector('a[href*="/profile.php"]');
      userId = postProfileUserLink ? postProfileUserLink.href.split('=')[1] : '1';
    }
    return userId;
  }

  getClearedForumName(name) {
    return name[0] === String.fromCharCode(173) ?
      name.substr(1) // совместимость со скриптом подфорумов
      : name;
  }

  getSignaturePattern() {
    return new RegExp('<dl class="post-sig">([\\s\\S]*?)?<\\/dl>', 'g');
  }

  getCodeBoxPattern() {
    return new RegExp('<div class="code-box"><strong class="legend">([\\s\\S]*?)?<\\/strong><div class="blockcode"><div class="scrollbox" style="(?:.*?)"><pre>([\\s\\S]*?)?<\\/pre><\\/div><\\/div><\\/div>', 'gi');
  }

  getPostHtmlWithoutCodeboxes(html, delimiter) {
    return html.replace(this.getCodeBoxPattern(), delimiter || '');
  }

  getTagPattern(tag) {
    return new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\/${tag}\\]`, 'gi');
  }

  strToHtml(str) {
    let error = { name: 'wrongtag' };
    const forbiddenTags = ['input', 'button', 'script', 'iframe', 'frame', 'style', 'audio', 'video', 'form',
      'footer', 'header', 'head', 'html', 'map', 'select', 'textarea', 'xmp', 'object', 'embed',
      'var', 'meta'];
    const forbiddenEvents = ['onblur', 'onchange', 'onclick', 'ondblclick', 'onfocus', 'onkeydown', 'onkeypress',
      'onkeyup', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onreset',
      'onselect', 'onscroll', 'onsubmit', 'onunload', 'javascript', 'onerror', 'oninput', 'onafterprint',
      'onbeforeprint', 'onbeforeunload', 'onhashchange', 'onmessage', 'onoffline', 'ononline', 'onpagehide',
      'onpageshow', 'onpopstate', 'onresize', 'onstorage', 'oncontextmenu', 'oninvalid', 'onreset', 'onsearch',
      'ondrag', 'ondragend', 'ondragenter', 'ondragleave', 'ondragover', 'ondragstart', 'ondrop', 'onmousedown',
      'onmousewheel', 'onwheel', 'oncopy', 'oncut', 'onpaste', 'onabort', 'oncanplay', 'oncanplaythrough',
      'oncuechange', 'ondurationchange', 'onemptied', 'onended', 'onerror', 'onloadeddata', 'onloadedmetadata',
      'onloadstart', 'onpause', 'onplay', 'onplaying', 'onprogress', 'onratechange', 'onseeked', 'onseeking',
      'onstalled', 'onsuspend', 'ontimeupdate', 'onvolumechange', 'onwaiting'];

    try {
      forbiddenTags.forEach(tag => {
        const pattern = new RegExp(`(<|&lt;)${tag}( |>|/)?`);
        const match = pattern.exec(str);
        if (match) {
          throw error;
        }
      });
      forbiddenEvents.forEach(tag => {
        const pattern = new RegExp(`${tag}=`);
        const match = pattern.exec(str);
        if (match) {
          throw error;
        }
      });
    }
    catch (err) {
      if (err.name === 'wrongtag') {
        return '';
      }
    }
    const check = /&lt;(.*?)?( xlink:| id=(.*?)?)/.test(str);

    // todo: проверить открытые/закрытые тэги
    return check ? '' : str.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }

  checkImageUrl(url) {
    return /^(http)?s?:?(\/\/[^"']*\.(?:png|jpg|jpeg|gif|png|svg))$/.test(url);
  }

}

const hvScriptSet = {

  addMask: (opt) => new AddMask(opt),

  temp: function (opt = {}) {

    let tmpMask = {};
    let previewForm = {};
    let errorList = {};

    const allTagsList = getTagList();

    const defaultAvatar = opt.defaultAvatar || 'http://i.imgur.com/bQuC3S1.png';

    let prevMasks = getStorageMask() !== '' ? getStorageMask().split('|splitKey|') : [];

    let posts = [];

    function getPosts() {
      posts = document.querySelectorAll('.post');
      let changedPosts = [];
      let changedUsersId = [];

      posts.forEach(post => {
        const postEl = post.querySelector('.post-content');
        const postChangeList = getTags(postEl.innerHTML);
        const userId = getUserIdFromPost(post);

        if (Object.keys(postChangeList).length === 0) return;

        changedPosts.push({
          post: post,
          postId: post.getAttribute('id'),
          userId: userId,
          text: postEl,
          clearedText: getClearedPost(postEl, postChangeList),
          profile: post.querySelector('.post-author ul'),
          changeList: postChangeList,
          signature: post.querySelector('.post-sig dd')
        });

        if (!changedUsersId.includes(userId)) changedUsersId.push(userId);
      });
      const checkAccess = changedUsersId.length > 0 ? getAccess(changedUsersId) : {};
      changedPosts = changedPosts.map(post => {
        return {
          ...post,
          ...checkAccess[post.userId]
        }
      });

      changedPosts.forEach(post => {
        Object.keys(post.changeList).forEach(key => {
          if (key === 'avatar') {
            post.access.common && changePostAvatar(post);
            return;
          }
          if (!post.access.extended) {
            return;
          }

          if (key === 'author') {
            changePostAuthor(post);
            return;
          }

          if (!post.profile.querySelector(`.${post.changeList[key].field}`)) {
            insertProfileField(post.profile, post.changeList[key].field)
          }
          switch (post.changeList[key].type) {
            case 'html':
              changePostHtml(post, key);
              break;
            case 'bbcode':
              changePostBBCode(post, key);
              break;
            case 'text':
              changePostText(post, key);
              break;
            case 'signature':
              changePostSignature(post);
              break;
            default:
              changePostText(post);
          };
        });
        const sign = post.text.innerHTML.match(/<dl class="post-sig">([\s\S]*?)?<\/dl>/);
        post.profile.classList.add('hv-mask');
        post.text.innerHTML = post.clearedText + (sign ? sign[0] : '');
      });
    }

    function changePostAvatar(post) {
      const avatarEl = post.profile.querySelector('.pa-avatar img');
      if (avatarEl) {
        avatarEl.src = post.changeList.avatar.content;
        avatarEl.removeAttribute('width');
        avatarEl.removeAttribute('height');
      } else {
        const prev = userFields[userFields.indexOf('pa-avatar') - 1];
        const el = prev
          ? post.profile.querySelector(`.${prev}`)
          : post.profile;
        const place = prev
          ? 'afterEnd'
          : 'beforeEnd';
        el.insertAdjacentHTML(
          place,
          `<div class="pa-avatar"><img src="${post.changeList.avatar.content}"></div>`
        );
      }
    }

    function changePostAuthor(post) {
      const author = post.profile.querySelector('.pa-author a')
        || post.profile.querySelector('.pa-author');
      const content = post.changeList.author.content.substring(0, 25)
      author.innerText = content;
      if (author.href && author.href.includes('javascript')) {
        author.href = `javascript:to('${content}')`;
      };
      if (post.post.querySelector('.pl-quote a')) {
        post.post.querySelector('.pl-quote a').href = `javascript:quote('${content}', ${post.postId.slice(1)})`
      }
    }

    function changePostHtml(post, key) {
      let content = strToHtml(post.changeList[key].content);
      if (content === '') {
        if (UserID === post.userId) {
          $.jGrowl(`Что-то не так с маской в вашем посте ${post.postId}. В ней найдены некорректные тэги. Маска не будет применена.`, { header: 'Ошибка скрипта маски', sticky: true });
          return;
        }
        if (GroupID === 1 || GroupID === 2) {
          $.jGrowl(`Что-то не так с маской юзера ${post.username} в посте ${post.postId}. В ней найдены некорректные тэги. Маска не будет применена.`, { header: 'Ошибка скрипта маски', sticky: true });
          return;
        }
      }
      if (content.length > 999) return;

      const field = post.profile.querySelector(`.${post.changeList[key].field}`);
      field.innerHTML = content;
    }

    function changePostBBCode(post, key) {
      const content = post.changeList[key].content;
      if (content.length > 999) return;

      const field = post.profile.querySelector(`.${post.changeList[key].field}`);
      field.innerHTML = content;
    }

    function changePostText(post, key) {
      let content = post.changeList[key].content
        .replace(/</i, '&lt').replace(/>/i, '&rt');
      const limit = key === 'title' ? 50 : 999;

      const field = post.profile.querySelector(`.${post.changeList[key].field}`);
      field.innerHTML = content;
    }

    function changePostSignature(post) {
      if (GroupID === '3') return;

      if (!post.signature) {
        post.text.insertAdjacentHTML(
          'beforeEnd',
          `<dl class="post-sig">
          <dt><span>Подпись автора</span></dt>
          <dd>${post.changeList['signature'].content}</dd></dl>`
        );
        return;
      }
      post.signature.innerHTML = post.changeList['signature'].content;
    }

    function insertProfileField(profile, field) {
      let prev;
      for (let i = userFields.indexOf(field); i >= 0; --i) {
        if (profile.querySelector(`.${userFields[i]}`)) {
          prev = userFields[i];
          break;
        }
      }
      const el = prev ? profile.querySelector(`.${prev}`)
        : profile;
      const place = prev ? 'afterEnd' : 'beforeEnd';
      el.insertAdjacentHTML(
        place,
        `<div class="${field}"></div>`
      );
    }

    function getTagPattern(tag) {
      return new RegExp(`\\[${tag}\\](.*?)\\[\/${tag}\\]`, 'gi');
    }

    function hideTags() {
      posts = document.querySelectorAll('.post-content');
      posts.forEach(post => {
        const tags = getTags(post.innerHTML);
        if (Object.keys(tags).length > 0) {
          post.innerHTML = getClearedPost(post, tags);
        }
      });
    }

    function getUserIdFromPost(post) {
      let userId = '1';
      if (UserID === 1) {
        const postUserNameLink = post.querySelector('.pa-author a');
        if (postUserNameLink && postUserNameLink.href.includes('/profile.php')) {
          userId = postUserNameLink.href.split('=')[1];
        }
      } else {
        const postProfileLinks = post.querySelector('.post-links');
        let postProfileUserLink = postProfileLinks.querySelector('a[href*="/profile.php"]');
        userId = postProfileUserLink ? postProfileUserLink.href.split('=')[1] : '1';
      }
      return userId;
    }

    function getTags(text) {
      let postChangeList = {};
      let clearedText = text.replace(/<div class="code-box"><strong class="legend">([\s\S]*?)?<\/strong><div class="blockcode"><div class="scrollbox" style="(?:.*?)"><pre>([\s\S]*?)?<\/pre><\/div><\/div><\/div>/gi, '');
      for (let field in changeList) {
        if (changeList.hasOwnProperty(field)) {
          let tags = changeList[field].tag.split(',');
          for (let i = tags.length; i >= 0; i--) {
            if (tags.hasOwnProperty(i)) {
              let pattern = new RegExp('\\[' + tags[i] + '\\]([\\s\\S]*?)\\[\\/' + tags[i] + '\\]', 'gmi');
              let clearPattern = new RegExp('\\[(\\/?)' + tags[i] + '\\]', 'gmi');
              if (clearedText.match(pattern)) {
                postChangeList[field] = {
                  'tag': tags[i],
                  'field': changeList[field].class,
                  'content': text.match(pattern)[0].replace(clearPattern, ''),
                  'type': changeList[field].type
                };
              }
            }
          }
        }
      }
      return postChangeList;
    }

    function getTagList() {
      let tagList = [];
      for (let field in changeList) {
        if (changeList.hasOwnProperty(field)) {
          let tags = changeList[field].tag.split(',');
          for (let i in tags) {
            if (tags.hasOwnProperty(i) && !tagList.indexOf(tags[i]) + 1) {
              tagList.push(tags[i]);
            }
          }
        }
      }
      return tagList;
    }

    function getAccess(usersId) {
      let userInfo = getUsersInfo(usersId);
      const forumName = getClearedForumName(FORUM.topic.forum_name);
      for (let id in userInfo) {
        if (userInfo.hasOwnProperty(id)) {
          switch (userInfo[id].groupId) {
            case '1':
            case '2':
              userInfo[id].access = {
                'common': true,
                'extended': true
              };
              break;
            case '3':
              userInfo[id].access = {
                'common': opt.guestAccess ?
                  opt.guestAccess.includes(forumName) : false,
                'extended': opt.guestAccess ?
                  opt.guestAccess.includes(forumName) : false
              };
              break;
            default:
              userInfo[id].access = {
                'common': opt.forumAccess && opt.forumAccess[forumName] ?
                  opt.forumAccess[forumName].includes(userInfo[id].groupTitle) : true,
                'extended': opt.forumAccessExtended && opt.forumAccessExtended[forumName] ?
                  opt.forumAccessExtended[forumName]
                    .includes(userInfo[id].groupTitle) : false
              };
          }
        }
      }
      return userInfo;
    }

    function getUsersInfo(usersId) {
      let usersIdStr = usersId.filter(item => +item > 1).join(',');
      let usersInfo = {};
      if (usersId.includes('1')) {
        usersInfo['1'] = {
          'userId': '1',
          'username': 'Guest',
          'groupId': '3',
          'groupTitle': 'Гость'
        };
      }
      if (usersIdStr) {
        $.ajax({
          async: false,
          url: '/api.php',
          data: {
            method: 'users.get',
            user_id: usersIdStr
          },
          success: function success(json) {
            for (let i in json.response.users) {
              if (json.response.users.hasOwnProperty(i)) {
                usersInfo[json.response.users[i].user_id] = {
                  'userId': i,
                  'username': json.response.users[i].username,
                  'groupId': json.response.users[i].group_id,
                  'groupTitle': json.response.users[i].group_title
                };
              }
            }
          }
        });
      }

      return usersInfo;
    }

    function getDialog() {
      let maskButton = addButton();
      if (maskButton) {
        if (checkAccessExtended() || getAccessByForumName() === 'extended') {
          maskButton.addEventListener('click', (event) => {
            if (event.ctrlKey || event.metaKey) {
              insertAvatarTags();
            } else {
              callMaskDialog();
            }
          });
        } else {
          maskButton.addEventListener('click', insertAvatarTags);
        }
      }
      let maskDialog = buildMaskDialog();
      let main = document.querySelector('#pun-main');
      main.appendChild(maskDialog);

      getStyle();
    }

    function getStyle() {
      let style = document.createElement('style');
      style.innerHTML = `#mask_dialog .hv-bg {
                position: fixed;
                display: flex;
                align-content: center;
                justify-content: center;
                align-items: center;
                z-index: 10;
                width: 100%;
                height: 100%;
                left: 0;
                top: 0;
                background: rgba(0, 0, 0, .4);
                cursor: pointer;
            }

            #mask_dialog .inner {
                cursor: default;
                margin: 0;
                width: 760px;
                max-width: 99%;
                max-height: 90%;
                overflow-x: auto;
                z-index: 100;
                box-shadow: 0 0 40px #222;
                background: #F4F5F6 url("http://i.imgur.com/akmlat3.png");
                padding: 8px;
            }

            #mask_dialog .inner * {
                box-sizing: border-box;
            }

            #mask_dialog .inner .hv-mask-dialog-title {
                text-align: center;
                font-weight: 700;
                font-size: 18px;
                line-height: 34px;
                position: relative;
            }

            #mask_dialog .inner .hv-error-list {
                padding: 8px;
                margin: 8px;
                background: #DAA396;
                color: #BD0909;
                border: solid 1px;
            }

            #mask_dialog .inner .hv-mask-block {
                display: flex;
                justify-content: space-between;
                align-items: stretch;
            }

            #mask_dialog .inner .hv-mask-block .hv-preview-block {
                flex: 0 0 120px;
                text-align: center;
                max-width: 120px;
                overflow: hidden;
                word-break: break-word;
            }

            #mask_dialog .inner .hv-mask-block .hv-preview-block > div {
                padding: 3px 0;
            }

            #mask_dialog .inner .hv-mask-block .hv-form-block {
                flex: 1 1 auto;
            }

            #mask_dialog .inner .hv-mask-block .hv-preview-block .hv-preview-avatar img {
                max-width: 100px;
            }

            #mask_dialog .inner .hv-mask-block .hv-form-block {
                flex: 1 1 auto;
            }

            #mask_dialog .inner .hv-mask-block .hv-form-block label {
                display: block;
                margin-bottom: px;
            }

            #mask_dialog .inner .hv-mask-block .hv-form-block label:after {
                content: "";
                display: table;
                clear: both;
                margin-bottom: 2px;
            }

            #mask_dialog .inner .hv-mask-block .hv-form-block .hv-description {
                font-size: .9em;
                color: #999;
                font-style: italic;
            }

            #mask_dialog .inner .hv-mask-block .hv-form-block .hv-add-template {
                cursor: pointer;
                float: right;
                padding: 2px 4px;
                border: solid 1px #ccc;
            }

            #mask_dialog .inner .hv-mask-block .hv-form-block input,
            #mask_dialog .inner .hv-mask-block .hv-form-block textarea {
                width: 100%;
            }

            #mask_dialog .inner .hv-mask-block .hv-form-block .hv-mask-field {
                position: relative;
            }

            #mask_dialog .inner .hv-mask-block .hv-form-block .hv-mask-field + .hv-mask-field {
                margin-top: 10px;
            }

            #mask_dialog .inner .hv-masks-storage {
                flex: 0 1 140px;
                display: flex;
                align-items: flex-start;
                align-content: flex-start;
                justify-content: flex-start;
                padding: 8px;
                flex-wrap: wrap;
                list-style: none;
            }

            #mask_dialog .inner .hv-masks-storage.hidden {
                display: none;
            }

            #mask_dialog .inner .hv-masks-storage .hv-mask-element {
                width: 60px;
                padding: 4px;
                position: relative;
            }

            #mask_dialog .inner .hv-masks-storage .hv-mask-element img {
                max-width: 100%;
                cursor: pointer;
            }

            #mask_dialog .inner .hv-masks-storage .hv-mask-element .hv-mask-tooltip {
                position: absolute;
                top: 4px;
                min-width: 160px;
                right: 60px;
                padding: 4px;
                z-index: 5;
                overflow-y: auto;
                background: rgba(255, 255, 255, .6);
                border: solid 1px #ccc;
                display: none;
            }

            #mask_dialog .inner .hv-masks-storage .hv-mask-element > img:hover + .hv-mask-tooltip {
                display: block;
            }

            #mask_dialog .inner .hv-masks-storage .hv-mask-element .hv-mask-tooltip > * {
                zoom: .7
            }

            #mask_dialog .inner .hv-masks-storage .hv-mask-element .hv-delete-mask {
                display: block;
                font-size: 10px;
                text-align: center;
                cursor: pointer;
            }

            #mask_dialog .inner .hv-control {
                padding: 8px;
                text-align: center;
                position: relative;
            }

            #mask_dialog .inner .hv-control input + input {
                margin-left: 10px;
            }

            #mask_dialog .inner .hv-control .hv-clear-storage {
                position: absolute;
                right: 0;
                bottom: 0;
                color: #666;
                cursor: pointer;
            }`;

      let docstyle = document.head.querySelector('link[href*="style"]');
      document.head.insertBefore(style, docstyle);
    }

    function insertAvatarTags() {
      bbcode('[icon]', '[/icon]');
    }

    function setSelectionRange(input, selectionStart, selectionEnd) {
      if (input.setSelectionRange) {
        input.focus();
        input.setSelectionRange(selectionStart, selectionEnd);
      } else if (input.createTextRange) {
        let range = input.createTextRange();
        range.collapse(true);
        range.moveEnd('character', selectionEnd);
        range.moveStart('character', selectionStart);
        range.select();
      }
    }

    function changeMaskForm(field, value) {
      let str = '';
      switch (field) {
        case 'signature':
          break;
        case 'avatar':
          str = value !== '' ? value : getAvatar();
          if (!checkImage(str)) {
            errorList[field] = 'В поле [Аватар] должна быть ссылка на картинку формата jpg, gif или png';
          } else {
            delete errorList[field];
            previewForm.querySelector(`.hv-preview-${field} img`).src = str;
          }
          break;
        case 'author':
          if (value.length > 25) {
            errorList[field] = 'Поле [Ник] не должно содержать больше 25 символов';
          } else {
            str = value !== '' ? value : UserLogin;
            delete errorList[field];
            previewForm.querySelector(`.hv-preview-${field}`).innerText = str;
          }
          break;
        case 'title':
          if (value.length > 50) {
            errorList[field] = 'Поле [Статус] не должно содержать больше 50 символов';
          } else {
            delete errorList[field];
            str = value !== '' ? value : getUserTitle();
            previewForm.querySelector(`.hv-preview-${field}`).innerText = str;
          }
          break;
        default:
          if (value.length > 999) {
            errorList[field] = `Поле [${changeList[field].title}] не должно содержать больше 999 символов`;
          } else {
            delete errorList[field];
            str = value || '';
            switch (changeList[field].type) {
              case 'text':
                delete errorList[field];
                previewForm.querySelector(`.hv-preview-${field}`).innerHTML = str.replace(/</gi, '&lt;');
                break;
              case 'bbcode':
                delete errorList[field];
                previewForm.querySelector(`.hv-preview-${field}`).innerHTML = bbcodeToHtml(str);
                break;
              default:
                if (checkHtml(str)) {
                  errorList[field] = `В поле [${changeList[field].title}] недопустимые теги`;
                } else {
                  delete errorList[field];
                  previewForm.querySelector(`.hv-preview-${field}`).innerHTML = str;
                }
            }
          }
          break;
      }
      showErrors();
    }

    function showErrors() {
      let errorListBlock = document.querySelector('#mask_dialog .hv-error-list');
      errorListBlock.innerHTML = '';
      if (Object.keys(errorList).length) {
        errorListBlock.style.display = 'block';
        for (let error in errorList) {
          if (errorList.hasOwnProperty(error)) {
            let li = document.createElement('li');
            li.innerHTML = `<li> ! ${errorList[error]}</li>`;
            errorListBlock.appendChild(li);
          }
        }
      } else {
        errorListBlock.style.display = 'none';
      }
    }

    function fillForm(obj) {
      let form = document.querySelector('#mask_form');
      for (let change in changeList) {
        if (changeList.hasOwnProperty(change)) {
          let field = form.querySelector('#mask_' + change);
          if (obj[change]) {
            field.value = obj[change].value;
            tmpMask[change] = {
              'tag': obj[change].tag,
              'value': obj[change].value
            };
            changeMaskForm(change, obj[change].value);
          } else {
            field.value = '';
            delete tmpMask[change];
            changeMaskForm(change, '');
          }
        }
      }
    }

    function getAvatar() {
      return UserAvatar ? UserAvatar : defaultAvatar;
    }

    function getUserTitle() {
      return UserTitle ? UserTitle : 'Статус';
    }

    function addButton() {
      let form = document.getElementById("form-buttons");
      if (form && (checkAccess() || checkAccessExtended() || getAccessByForumName())) {
        let button = document.createElement('td');
        button.id = 'button-mask';
        button.title = 'Маска профиля';
        button.innerHTML = '<img src="/i/blank.gif">';
        let bgImage = opt.buttonImage ? opt.buttonImage : 'http://i.imgur.com/ONu0llO.png';
        button.style.backgroundImage = 'url("' + bgImage + '")';
        form.getElementsByTagName('tr')[0].appendChild(button);
        return button;
      } else {
        return null;
      }
    }

    function callMaskDialog() {
      let maskDialog = document.getElementById('mask_dialog');
      maskDialog.style.display = 'block';
      getMaskStorage(prevMasks);
      document.addEventListener('keyup', hideMaskByEsc);
    }

    function hideMaskDialog() {
      let maskDialog = document.getElementById('mask_dialog');
      maskDialog.style.display = 'none';
      document.removeEventListener('keyup', hideMaskByEsc);
    }

    function hideMaskByEsc(e) {
      if (e.keyCode === 27) hideMaskDialog();
    }

    function buildMaskDialog() {
      let code = document.createElement('div');
      code.id = 'mask_dialog';
      code.style.display = 'none';

      let bg = document.createElement('div');
      bg.className = 'hv-bg';

      bg.addEventListener('click', event => {
        if (event.target === bg) {
          hideMaskDialog();
        }
      });

      let inner = document.createElement('div');
      inner.className = 'inner container';

      let title = document.createElement('div');
      title.className = 'hv-mask-dialog-title';
      title.innerHTML = 'Маска профиля';

      let errorListBlock = document.createElement('ul');
      errorListBlock.className = 'hv-error-list';
      errorListBlock.style.display = 'none';

      let showPreviewFlag = opt.showPreview || true;

      let preview = document.createElement('div');
      previewForm = preview;
      preview.className = 'hv-preview-block';
      clearPreview();

      let form = document.createElement('form');
      form.id = 'mask_form';

      let previewMaskForm = document.createElement('form');
      previewMaskForm.id = 'hv_preview_form';
      previewMaskForm.style.display = 'none';

      let previewFormSent = document.createElement('input');
      previewFormSent.type = 'hidden';
      previewFormSent.name = 'form_sent';
      previewFormSent.value = 1;
      let previewFormUser = document.createElement('input');
      previewFormUser.type = 'hidden';
      previewFormUser.name = 'form_user';
      previewFormUser.value = UserLogin;
      let previewReqMessage = document.createElement('textarea');
      previewReqMessage.name = 'req_message';
      previewMaskForm.appendChild(previewFormSent);
      previewMaskForm.appendChild(previewFormUser);
      previewMaskForm.appendChild(previewReqMessage);

      let _loop = function _loop(mask) {
        if (changeList.hasOwnProperty(mask)) {
          (function () {
            let li = document.createElement('div');
            li.className = 'hv-mask-field ' + mask;
            let input = void 0;
            switch (changeList[mask].type) {
              case 'html':
              case 'signature':
              case 'bbcode':
                input = document.createElement('textarea');
                input.id = 'mask_' + mask;
                break;
              default:
                input = document.createElement('input');
                input.type = 'text';
                input.id = 'mask_' + mask;
            }
            input.addEventListener('blur', () => {
              let idField = input.id.split('mask_')[1];
              if (input.value !== '' && !checkHtml(input.value)) {
                tmpMask[idField] = {
                  'tag': changeList[idField].tag.split(',')[0],
                  'value': input.value
                };
              } else {
                delete tmpMask[idField];
              }
              changeMaskForm(idField, input.value);
            });
            let label = document.createElement('label');
            label.for = 'mask_' + mask;

            label.innerHTML += '<b>' + changeList[mask].title + '</b>';
            if (changeList[mask].description) {
              label.innerHTML += '<div class="description">' + changeList[mask].description + '</div>';
            }
            li.appendChild(label);
            if (changeList[mask].defaultCode) {
              let templateButton = document.createElement('div');
              templateButton.className = 'button hv-add-template';
              templateButton.innerText = '« вставить шаблон';
              templateButton.title = 'Вставить шаблон';
              templateButton.addEventListener('click', function () {
                fillInput(input, changeList[mask].defaultCode);
                changeMaskForm(mask, input.value);
              });
              label.insertBefore(templateButton, label.querySelector('b'));
            }
            li.appendChild(input);
            form.appendChild(li);
          })();
        }
      };

      for (let mask in changeList) {
        _loop(mask);
      }

      let formBlock = document.createElement('div');
      formBlock.className = 'hv-form-block';
      formBlock.appendChild(form);
      formBlock.appendChild(previewMaskForm);

      let userMasks = document.createElement('ul');
      userMasks.className = 'hv-masks-storage';
      if (prevMasks.length > 0) {
      } else {
        userMasks.className += ' hidden';
      }

      let block = document.createElement('div');
      block.className = 'hv-mask-block';
      if (showPreviewFlag) {
        block.appendChild(preview);
      }
      block.appendChild(formBlock);
      block.appendChild(userMasks);

      let okButton = document.createElement('input');
      okButton.type = 'button';
      okButton.className = 'button';
      okButton.name = 'insertMask';
      okButton.value = 'Вставить маску';
      okButton.addEventListener('click', insertMask);

      let clearButton = document.createElement('input');
      clearButton.type = 'button';
      clearButton.className = 'button';
      clearButton.name = 'clearMask';
      clearButton.value = 'Очистить';
      clearButton.addEventListener('click', clearMask);

      let cancelButton = document.createElement('input');
      cancelButton.type = 'button';
      cancelButton.className = 'button';
      cancelButton.name = 'cancelMask';
      cancelButton.value = 'Отмена';
      cancelButton.addEventListener('click', cancelMask);

      let clearStorageButton = document.createElement('span');
      clearStorageButton.className = 'hv-clear-storage';
      clearStorageButton.name = 'clearStorageMask';
      clearStorageButton.innerText = 'Очистить хранилище';
      clearStorageButton.title = 'Сбрасывает все маски. Нажать при проблемах сохранения/отображения сохраненных масок.';
      clearStorageButton.addEventListener('click', clearStorageMask);

      let control = document.createElement('div');
      control.className = 'hv-control';
      control.appendChild(okButton);
      control.appendChild(clearButton);
      control.appendChild(cancelButton);
      control.appendChild(clearStorageButton);

      inner.appendChild(title);
      inner.appendChild(errorListBlock);
      inner.appendChild(block);
      inner.appendChild(control);

      code.appendChild(bg);
      bg.appendChild(inner);

      return code;
    }

    function getMaskStorage(prevMasks) {
      let maskDialog = document.getElementById('mask_dialog');
      let maskStore = maskDialog.querySelector('.hv-masks-storage');
      if (prevMasks.length > 0) {
        maskStore.className = maskStore.className.replace(/ hidden/gi, '');
      } else {
        maskStore.className += ' hidden';
      }
      maskStore.innerHTML = '';

      let _loop2 = function _loop2(mask) {
        let mymask = JSON.parse(prevMasks[mask]);
        let li = document.createElement('li');
        li.className = 'hv-mask-element';
        let tempavatar = mymask['avatar'] ? mymask['avatar'].value : defaultAvatar;
        let avatar = document.createElement('img');
        avatar.src = tempavatar;
        let infoBlock = document.createElement('div');
        infoBlock.className = 'hv-mask-tooltip';

        for (let item in changeList) {
          if (changeList.hasOwnProperty(item) && item !== 'avatar' && mymask[item]) {
            if (!checkHtml(mymask[item].value.toString())) {
              infoBlock.innerHTML += '<div class="' + item + '"><b>' + changeList[item].title + ':</b> ' +
                mymask[item].value + '</div>';
            }
          }
        }
        let deleteMask = document.createElement('a');
        deleteMask.className = 'hv-delete-mask';
        deleteMask.innerText = 'Удалить';
        deleteMask.title = 'Удалить маску из списка';
        deleteMask.addEventListener('click', () => deleteMaskFromStorage(mask));
        li.appendChild(avatar);
        if ((mymask['avatar'] && Object.keys(mymask).length > 1) ||
          (!mymask['avatar'] && Object.keys(mymask).length > 0)) {
          li.appendChild(infoBlock);
        }
        li.appendChild(deleteMask);
        avatar.addEventListener('click', () => fillForm(mymask));
        maskStore.appendChild(li);
      };

      for (let mask = 0; mask < prevMasks.length; mask++) {
        _loop2(mask);
      }
    }

    function fillInput(input, value) {
      input.value = value;
    }

    function insertMask() {
      if (Object.keys(tmpMask).length > 0) {
        insert(getStrMask());
        let tempMask = JSON.stringify(tmpMask);
        if (Object.keys(prevMasks).length > 0) {
          prevMasks = getStorageMask().split('|splitKey|');
          if (!(hasMaskInSrorage(prevMasks, tmpMask) + 1)) {
            if (prevMasks.length > 5) {
              prevMasks.splice(0, 1);
            }
          } else {
            prevMasks.splice(hasMaskInSrorage(prevMasks, tmpMask), 1);
          }
        }
        prevMasks.push(JSON.stringify(tmpMask));
        $.post('/api.php',
          {
            method: 'storage.set',
            token: ForumAPITicket,
            key: 'maskListUser',
            value: encodeURI(prevMasks.join('|splitKey|'))
          }
        );
        getMaskStorage(prevMasks);
        clearMask();
        hideMaskDialog();
      }
    }

    function hasMaskInSrorage(storage, item) {
      let res = -1;
      for (let i = 0; i < storage.length; i++) {
        let obj = JSON.parse(storage[i]);
        if (Object.keys(obj).length === Object.keys(item).length) {
          let counter = 0;
          for (let k in obj) {
            if (obj.hasOwnProperty(k)) {
              if (JSON.stringify(obj[k]) !== JSON.stringify(item[k])) {
                break;
              } else {
                counter++;
              }
            }
            if (counter === Object.keys(obj).length) {
              res = i;
            }
          }
        }
      }
      return res;
    }

    function deleteMaskFromStorage(mask) {
      prevMasks.splice(mask, 1);
      $.post('/api.php',
        {
          method: 'storage.set',
          token: ForumAPITicket,
          key: 'maskListUser',
          value: encodeURI(prevMasks.join('|splitKey|'))
        }
      );
      getMaskStorage(prevMasks);
    }

    function clearStorageMask() {
      prevMasks = [];
      $.ajax({
        async: false,
        url: '/api.php',
        data: {
          method: 'storage.delete',
          token: ForumAPITicket,
          key: 'maskListUser'
        }
      });
      getMaskStorage(prevMasks);
    }

    function clearMask() {
      tmpMask = {};
      clearPreview();
      errorList = {};
      showErrors();
      let maskForm = document.getElementById('mask_form');
      maskForm.reset();
    }

    function cancelMask() {
      clearMask();
      hideMaskDialog();
    }

    function clearPreview() {
      previewForm.innerHTML = '';
      for (let mask in changeList) {
        if (changeList.hasOwnProperty(mask)) {
          let div = document.createElement('div');
          div.className = `hv-preview-${mask}`;
          switch (mask) {
            case 'author':
              div.innerHTML = UserLogin;
              previewForm.appendChild(div);
              break;
            case 'title':
              div.innerHTML = getUserTitle();
              previewForm.appendChild(div);
              break;
            case 'avatar':
              let src = getAvatar();
              div.innerHTML = '<img src="' + src + '">';
              previewForm.appendChild(div);
              break;
            case 'signature':
              break;
            default:
              div.innerHTML = '';
              previewForm.appendChild(div);
              break;
          }
        }
      }
    }

    function getStrMask() {
      let str = '';
      for (let change in tmpMask) {
        if (tmpMask.hasOwnProperty(change)) {
          str += `[${tmpMask[change].tag}]${tmpMask[change].value}[/${tmpMask[change].tag}]`;
        }
      }
      return str;
    }

    let forbiddenTags = ['input', 'button', 'script', 'iframe', 'frame', 'style', 'audio', 'video', 'form',
      'footer', 'header', 'head', 'html', 'map', 'select', 'textarea', 'xmp', 'object', 'embed',
      'var', 'meta'];
    let forbiddenEvents = ['onblur', 'onchange', 'onclick', 'ondblclick', 'onfocus', 'onkeydown', 'onkeypress',
      'onkeyup', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onreset',
      'onselect', 'onscroll', 'onsubmit', 'onunload', 'javascript', 'onerror', 'oninput', 'onafterprint',
      'onbeforeprint', 'onbeforeunload', 'onhashchange', 'onmessage', 'onoffline', 'ononline', 'onpagehide',
      'onpageshow', 'onpopstate', 'onresize', 'onstorage', 'oncontextmenu', 'oninvalid', 'onreset', 'onsearch',
      'ondrag', 'ondragend', 'ondragenter', 'ondragleave', 'ondragover', 'ondragstart', 'ondrop', 'onmousedown',
      'onmousewheel', 'onwheel', 'oncopy', 'oncut', 'onpaste', 'onabort', 'oncanplay', 'oncanplaythrough',
      'oncuechange', 'ondurationchange', 'onemptied', 'onended', 'onerror', 'onloadeddata', 'onloadedmetadata',
      'onloadstart', 'onpause', 'onplay', 'onplaying', 'onprogress', 'onratechange', 'onseeked', 'onseeking',
      'onstalled', 'onsuspend', 'ontimeupdate', 'onvolumechange', 'onwaiting'];

    function strToHtml(str) {
      let forbiddenTag = '';
      let forbiddenTagsCheck = false;
      for (let i = 0; i < forbiddenTags.length; i++) {
        let pattern = new RegExp('(<|&lt;)' + forbiddenTags[i]);
        forbiddenTagsCheck = pattern.exec(str);
        if (forbiddenTagsCheck) {
          forbiddenTag = forbiddenTagsCheck[0].replace('&lt;', '');
          console.error(`Forbidden tag <${forbiddenTag}> in mask`);
          return '';
        }
      }
      for (let _i2 = 0; _i2 < forbiddenEvents.length; _i2++) {
        let _pattern = new RegExp(forbiddenEvents[_i2] + '=');
        forbiddenTagsCheck = _pattern.exec(str);
        if (forbiddenTagsCheck) {
          forbiddenTag = forbiddenTagsCheck[0].replace('&lt;', '');
          console.error(`Forbidden event <${forbiddenTag}> in mask`);
          return '';
        }
      }
      let check = /&lt;(.*?)?( xlink:| id=(.*?)?)/.test(str);
      if (check) {
        console.error('Forbidden tag properties in mask');
      }
      return check ? '' : str.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    }

    function bbcodeToHtml(str) {
      let tempStr = str.replace(/</gi, '&lt;');

      tempStr = tempStr.replace(/\n/gi, `<br />`);

      tempStr = tempStr.replace(/\[font=(.*?)\](.*?)\[\/font\]/gi, `<span style="font-family: $1">$2</span>`);
      tempStr = tempStr.replace(/\[size=(\d*?)\](.*?)\[\/size\]/gi, `<span style="font-family: $1px">$2</span>`);
      tempStr = tempStr.replace(/\[b\](.*?)\[\/b\]/gi, `<strong>$1</strong>`);

      tempStr = tempStr.replace(/\[i](.*?)\[\/i\]/gi, `<span style="font-style: italic">$1</span>`);
      tempStr = tempStr.replace(/\[u\](.*?)\[\/u\]/gi, `<em class="bbuline">$1</em>`);
      tempStr = tempStr.replace(/\[s\](.*?)\[\/s\]/gi, `<del>$1</del>`);

      tempStr = tempStr.replace(/\[align=([left|center|right]*?)\](.*?)\[\/align\]/gi,
        `<span style="display: block; text-align: $1">$2</span>`);
      tempStr = tempStr.replace(/\[url=(https?:\/\/.*?)\](.*?)\[\/url\]/gi,
        `<a href="$1" rel="nofollow" target="_blank">$2</a>`);
      tempStr = tempStr.replace(/\[url\](https?:\/\/.*?)\[\/url\]/gi,
        `<a href="$1" rel="nofollow" target="_blank">$1</a>`);
      tempStr = tempStr.replace(/\[color=(.*?)\](.*?)\[\/color\]/gi, `<span style="color: $1">$2</span>`);

      tempStr = tempStr.replace(/\[img\](https?:\/\/.*?\.(?:jpg|png|jpeg|gif))\[\/img\]/gi, `<img class="postimg" src="$1" alt="$1">`);

      tempStr = tempStr.replace(/\[you\]/gi, UserLogin);
      tempStr = tempStr.replace(/\[hr\]/gi, `<hr>`);
      tempStr = tempStr.replace(/\[sup\](.*?)\[\/sup\]/gi, `<sup>$1</sup>`);
      tempStr = tempStr.replace(/\[sub\](.*?)\[\/sub\]/gi, `<sub>$1</sub>`);
      tempStr = tempStr.replace(/\[mark\](.*?)\[\/mark\]/gi, `<span class="highlight-text">$1</span>`);
      tempStr = tempStr.replace(/\[abbr="(.*?)"\](.*?)\[\/abbr\]/gi, `<abbr title="$1">$2</abbr>`);

      return tempStr;
    }

    function checkHtml(html) {
      let forbiddenTagsCheck = false;
      for (let i = 0; i < forbiddenTags.length; i++) {
        let pattern = new RegExp('(<|&lt;)' + forbiddenTags[i]);
        forbiddenTagsCheck = pattern.exec(html);
        if (forbiddenTagsCheck) return true;
      }
      for (let _i3 = 0; _i3 < forbiddenEvents.length; _i3++) {
        let _pattern2 = new RegExp(forbiddenEvents[_i3] + '=');
        forbiddenTagsCheck = _pattern2.exec(html);
        if (forbiddenTagsCheck) return true;
      }
      return forbiddenTagsCheck;
    }

    function checkImage(src) {
      return (/\.jpg|\.png|\.gif/.test(src));
    }

    function checkAccess() {
      if (!FORUM.topic) return false;
      if (!opt.forumAccess || GroupID === 1 || GroupID === 2) return true;

      let forumName = getClearedForumName(FORUM.topic.forum_name);

      return opt.forumAccess[forumName] ?
        opt.forumAccess[forumName].includes(GroupTitle) :
        false;
    }

    function checkAccessExtended() {
      if (!FORUM.topic) return false;
      if (GroupID === 1 || GroupID === 2) return true;
      if (!opt.forumAccessExtended) return false;

      let forumName = getClearedForumName(FORUM.topic.forum_name);

      return opt.forumAccessExtended[forumName] ?
        opt.forumAccessExtended[forumName].includes(GroupTitle) :
        false;
    }

    function getStorageMask() {
      let mask = $.ajax({
        async: false,
        url: '/api.php',
        data: {
          method: 'storage.get',
          key: 'maskListUser'
        }
      });

      return JSON.parse(mask.responseText).response &&
        JSON.parse(mask.responseText).response.storage.data.maskListUser ?
        decodeURI(JSON.parse(mask.responseText).response.storage.data.maskListUser) : '';
    }

    function getClearedPost(post, chList) {
      let codeBoxes = post.innerHTML.match(/<div class="code-box"><strong class="legend">([\s\S]*?)?<\/strong><div class="blockcode"><div class="scrollbox" style="(?:.*?)"><pre>([\s\S]*?)?<\/pre><\/div><\/div><\/div>/gi, '|code-box-replacer|');
      let text = post.innerHTML.replace(/<div class="code-box"><strong class="legend">([\s\S]*?)?<\/strong><div class="blockcode"><div class="scrollbox" style="(?:.*?)"><pre>([\s\S]*?)?<\/pre><\/div><\/div><\/div>/gi, '|code-box-replacer|')
        .replace(/<dl class="post-sig">([\s\S]*?)?<\/dl>/g, '');
      for (let ch in chList) {
        if (chList.hasOwnProperty(ch)) {
          let pattern = new RegExp('\\[' + chList[ch].tag + '\\]([\\s\\S]*?)\\[\/' + chList[ch].tag + '\\]', 'gi');
          text = text.replace(pattern, '');
        }
      }
      for (let i in codeBoxes) {
        text = text.replace(/\|code-box-replacer\|/i, codeBoxes[i]);
      }
      return text;
    }

    function getClearedForumName(name) {
      return name[0] === String.fromCharCode(173) ?
        name.substr(1) // совместимость со скриптом подфорумов
        : name;
    }

    function getAccessByForumName() {
      if (GroupID === 1 || GroupID === 2) return 'extended';
      const crumbs = document.getElementById('pun-crumbs1');
      const link = crumbs.innerHTML.match(/\/viewforum\.php\?id=(\d*?)">(.*?)<\/a>/gi).pop();
      let name = link.replace(/\/viewforum\.php\?id=(\d*?)">(.*?)<\/a>/gi, '$2');
      name = getClearedForumName(name);
      if ((opt.forumAccessExtended && opt.forumAccessExtended[name])) {
        if (opt.forumAccessExtended[name].indexOf(GroupTitle) + 1) {
          return 'extended';
        }
      } else if (opt.forumAccess && opt.forumAccess[name]) {
        if (opt.forumAccess[name].indexOf(GroupTitle) + 1) {
          return 'common';
        }
      } else if (!opt.forumAccess && GroupID !== 3) {
        return 'common';
      } else {
        return 'none';
      }
    }

  }
};