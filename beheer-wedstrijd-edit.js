(function () {
  'use strict';

  var UPDATE_API_URL = 'https://qoemlqlhnrzvyujyehnc.supabase.co/functions/v1/beheer-wedstrijd-update';
  var FLASH_KEY = 'matchly_fixture_update_flash';
  var OPEN_PANEL = null;

  function getToken() {
    var parts = location.pathname.split('/').filter(Boolean);
    var index = parts.indexOf('beheer');
    return index >= 0 && parts[index + 1] ? decodeURIComponent(parts[index + 1]) : '';
  }

  function injectStyles() {
    if (document.getElementById('fixtureEditStyles')) return;
    var style = document.createElement('style');
    style.id = 'fixtureEditStyles';
    style.textContent = [
      '.fixture-edit-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;flex-shrink:0}',
      '.fixture-edit-panel{width:100%;margin:12px 0 4px;padding:14px;background:#0d0d14;border:1px solid rgba(239,26,120,.3);border-radius:12px}',
      '.fixture-edit-panel strong{font-size:17px;color:var(--text)}',
      '.fixture-edit-panel .fixture-edit-buttons{display:flex;gap:8px;margin-top:14px}',
      '.fixture-edit-panel .fixture-edit-buttons button{flex:1;margin:0;width:auto}',
      '.fixture-edit-panel .radio-group{flex-wrap:wrap}',
      '.fixture-edit-panel .fixture-edit-error{display:none;margin-top:10px;color:var(--danger);font-size:14px;line-height:1.4}',
      '@media(max-width:480px){.fixture-program-row{align-items:flex-start!important;flex-wrap:wrap}.fixture-edit-actions{width:100%;justify-content:flex-start}.fixture-edit-actions button{flex:1}}'
    ].join('');
    document.head.appendChild(style);
  }

  function parseDateLabel(label) {
    var match = String(label || '').match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
    if (!match) return { date: '', time: '14:30' };
    return {
      date: match[3] + '-' + match[2] + '-' + match[1],
      time: match[4] + ':' + match[5]
    };
  }

  function fixtureData(row, deleteButton) {
    var nameNode = row.querySelector('.name');
    var badge = nameNode ? nameNode.querySelector('.badge-type') : null;
    var cleanName = '';
    if (nameNode) {
      var clone = nameNode.cloneNode(true);
      var cloneBadge = clone.querySelector('.badge-type');
      if (cloneBadge) cloneBadge.remove();
      cleanName = clone.textContent.trim();
    }
    var isHome = cleanName.indexOf('Thuis tegen ') === 0;
    var opponent = cleanName.replace(/^(Thuis|Uit) tegen\s+/i, '').trim();
    var typeLabel = badge ? badge.textContent.trim().toLowerCase() : 'competitie';
    var matchType = typeLabel.indexOf('beker') >= 0 ? 'beker'
      : typeLabel.indexOf('oefen') >= 0 ? 'oefen'
      : typeLabel.indexOf('promotie') >= 0 ? 'promotie'
      : 'competitie';
    var dateParts = parseDateLabel(row.querySelector('.meta') ? row.querySelector('.meta').textContent : '');
    return {
      fixtureId: deleteButton.getAttribute('data-fixture-id'),
      opponent: opponent,
      date: dateParts.date,
      time: dateParts.time,
      isHome: isHome,
      matchType: matchType
    };
  }

  function radio(labelText, name, value, checked) {
    var label = document.createElement('label');
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    input.checked = checked;
    label.appendChild(input);
    label.appendChild(document.createTextNode(' ' + labelText));
    return label;
  }

  function fieldLabel(text) {
    var label = document.createElement('label');
    label.textContent = text;
    return label;
  }

  function openEditPanel(row, data) {
    if (OPEN_PANEL) OPEN_PANEL.remove();

    var panel = document.createElement('div');
    panel.className = 'fixture-edit-panel';
    OPEN_PANEL = panel;

    var title = document.createElement('strong');
    title.textContent = 'Wedstrijd wijzigen';
    panel.appendChild(title);

    panel.appendChild(fieldLabel('Type wedstrijd'));
    var typeGroup = document.createElement('div');
    typeGroup.className = 'radio-group';
    var typeName = 'edit_match_type_' + data.fixtureId;
    typeGroup.appendChild(radio('Competitie', typeName, 'competitie', data.matchType === 'competitie'));
    typeGroup.appendChild(radio('Beker', typeName, 'beker', data.matchType === 'beker'));
    typeGroup.appendChild(radio('Oefen', typeName, 'oefen', data.matchType === 'oefen'));
    typeGroup.appendChild(radio('Promotie/degradatie', typeName, 'promotie', data.matchType === 'promotie'));
    panel.appendChild(typeGroup);

    panel.appendChild(fieldLabel('Tegenstander'));
    var opponent = document.createElement('input');
    opponent.type = 'text';
    opponent.value = data.opponent;
    opponent.required = true;
    opponent.maxLength = 160;
    panel.appendChild(opponent);

    panel.appendChild(fieldLabel('Datum'));
    var date = document.createElement('input');
    date.type = 'date';
    date.value = data.date;
    date.required = true;
    panel.appendChild(date);

    panel.appendChild(fieldLabel('Tijd'));
    var time = document.createElement('input');
    time.type = 'time';
    time.value = data.time;
    time.required = true;
    panel.appendChild(time);

    var homeAway = document.createElement('div');
    homeAway.className = 'radio-group';
    var homeName = 'edit_home_' + data.fixtureId;
    homeAway.appendChild(radio('Thuis', homeName, 'thuis', data.isHome));
    homeAway.appendChild(radio('Uit', homeName, 'uit', !data.isHome));
    panel.appendChild(homeAway);

    var error = document.createElement('div');
    error.className = 'fixture-edit-error';
    panel.appendChild(error);

    var buttons = document.createElement('div');
    buttons.className = 'fixture-edit-buttons';
    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-outline';
    cancel.textContent = 'Annuleren';
    var save = document.createElement('button');
    save.type = 'button';
    save.className = 'btn-primary';
    save.textContent = 'Opslaan';
    buttons.appendChild(cancel);
    buttons.appendChild(save);
    panel.appendChild(buttons);

    cancel.addEventListener('click', function () {
      panel.remove();
      if (OPEN_PANEL === panel) OPEN_PANEL = null;
    });

    save.addEventListener('click', async function () {
      var chosenType = panel.querySelector('input[name="' + typeName + '"]:checked');
      var chosenHome = panel.querySelector('input[name="' + homeName + '"]:checked');
      if (!opponent.value.trim() || !date.value || !time.value || !chosenType || !chosenHome) {
        error.textContent = 'Vul alle gegevens in.';
        error.style.display = 'block';
        return;
      }

      save.disabled = true;
      cancel.disabled = true;
      save.textContent = 'Opslaan...';
      error.style.display = 'none';
      try {
        var response = await fetch(UPDATE_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: getToken(),
            action: 'update_fixture',
            fixture_id: data.fixtureId,
            opponent: opponent.value.trim(),
            date: date.value,
            time: time.value,
            thuis_of_uit: chosenHome.value,
            match_type: chosenType.value
          })
        });
        var result = await response.json().catch(function () { return {}; });
        if (!response.ok || !result.ok) throw new Error(result.message || 'Wijzigen is mislukt.');
        sessionStorage.setItem(FLASH_KEY, result.flash || 'Wedstrijd gewijzigd. De planning voor de Matchday-post is bijgewerkt.');
        location.reload();
      } catch (err) {
        error.textContent = err && err.message ? err.message : 'Wijzigen is mislukt.';
        error.style.display = 'block';
        save.disabled = false;
        cancel.disabled = false;
        save.textContent = 'Opslaan';
      }
    });

    row.insertAdjacentElement('afterend', panel);
    opponent.focus();
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function patchFixtureRows() {
    document.querySelectorAll('button[data-action="delete_fixture"]').forEach(function (deleteButton) {
      if (deleteButton.getAttribute('data-edit-ready') === '1') return;
      deleteButton.setAttribute('data-edit-ready', '1');

      var row = deleteButton.closest('.row');
      if (!row) return;
      row.classList.add('fixture-program-row');

      var actions = document.createElement('div');
      actions.className = 'fixture-edit-actions';
      deleteButton.parentNode.insertBefore(actions, deleteButton);
      actions.appendChild(deleteButton);

      var edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn-outline btn-sm';
      edit.textContent = 'Wijzigen';
      actions.insertBefore(edit, deleteButton);

      edit.addEventListener('click', function () {
        openEditPanel(row, fixtureData(row, deleteButton));
      });
    });
  }

  function showFlash() {
    var message = sessionStorage.getItem(FLASH_KEY);
    if (!message) return;
    var main = document.querySelector('main');
    if (!main || main.querySelector('[data-fixture-update-flash]')) return;
    sessionStorage.removeItem(FLASH_KEY);
    var flash = document.createElement('div');
    flash.className = 'flash';
    flash.setAttribute('data-fixture-update-flash', '1');
    flash.textContent = message;
    main.insertBefore(flash, main.firstChild);
  }

  function patch() {
    injectStyles();
    patchFixtureRows();
    showFlash();
  }

  var observer = new MutationObserver(patch);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patch);
  } else {
    patch();
  }
  setTimeout(patch, 500);
})();
