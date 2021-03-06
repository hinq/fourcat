$.fourcat = function() {
  
  var fc = this,
  
  defaults = {
    // Order: 'date', 'alt' or 'r'
    orderby: 'date',
    // Thumbnail size: 'small' or 'large'
    thsize: 'small',
    // Show teaser
    extended: true,
    // Redirect to the archive
    proxy: false,
    // Thumbnails server url
    contentUrl: '/',
    // Filter complete words
    filterFullWords: true,
    // Filters color palette
    filterColors: [
      ['#E0B0FF', '#F2F3F4', '#7DF9FF', '#FFFF00'],
      ['#FBCEB1', '#FFBF00', '#ADFF2F', '#0047AB'],
      ['#00A550', '#007FFF', '#AF0A0F', '#B5BD68']
    ],
    threadsPerPage: 15
  },
  
  keybinds = {
    83: focusQuickfilter, // S
    82: refreshWindow, // R
    88: cycleOrder // X
  },
  
  catalog = {},
  
  options = {},
  
  basicSettings = [ 'orderby', 'thsize', 'extended', 'proxy' ],
  
  baseFilter = {
    active: 1,
    pattern: '',
    color: '',
    hidden: 0,
    top: 0,
    hits: 0
  },
  
  activeTheme = {},
  
  activeFilters = {},
  
  // Tooltip options
  tipopts = {
    id: 'th-tip',
    title: tipCb,
    html: true,
    gravity: $.fn.tipsy.autoWE,
    delayIn: 350
  },
  
  pinnedThreads = {},
  
  hiddenThreads = {},
  hiddenThreadsCount = 0,
  
  quickFilterPattern = false,
  
  hasContextMenu = 'HTMLMenuItemElement' in window,
  hasNativeJSON = typeof JSON != 'undefined',
  hasWebStorage = (function() {
    try {
      localStorage.getItem('filters');
      return true;
    } catch(e) {
      return false;
    }
  })(),
  
  pulseInterval = null,
  
  $threads,
  $thumbs,
  $refresh,
  $qfCtrl,
  $proxyCtrl,
  $teaserCtrl,
  $sizeCtrl,
  $orderCtrl,
  $themePanel,
  $hiddenCount,
  $hiddenLabel,
  $filtersPanel,
  $filterList,
  $filterRgb,
  $filterRgbOk,
  $filteredCount,
  $filteredLabel,
  $filterPalette = null,
  
  ctxCmds;
  
  if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function () { return -1; }
  }
  
  loadTheme();
  
  // ---
  
  fc.init = function(opts) {
    applyTheme(activeTheme, true);
    
    $threads = $('#threads');
    $refresh = $('#refresh').tipsy({ gravity: 'sw' });
    $qfCtrl = $('#qf-ctrl').click(toggleQuickfilter);
    $proxyCtrl = $('#proxy-ctrl').tipsy({ gravity: 'se' });
    $teaserCtrl = $('#teaser-ctrl');
    $sizeCtrl = $('#size-ctrl');
    $orderCtrl = $('#order-ctrl');
    $themePanel = $('#theme');
    $hiddenCount = $('#hidden-count');
    $hiddenLabel = $('#hidden-label');
    $filtersPanel = $('#filters');
    $filterList = $('#filter-list');
    $filterRgb = $('#filter-rgb').keyup(filterSetCustomColor);
    $filterRgbOk = $('#filter-rgb-ok').click(selectFilterColor);
    $filteredCount = $('#filtered-count');
    $filteredLabel = $('#filtered-label');
    $('#filters-clear-hidden').click(clearHiddenThreads);
    $('#qf-clear').click(toggleQuickfilter);
    $('#theme-ctrl').click(showThemeEditor);
    $('#filters-ctrl').click(showFilters);
    
    if (hasContextMenu) {
      buildContextMenu();
    }
    
    $sizeCtrl.click(function() {
      setSize(options.thsize == 'small' ? 'large' : 'small');
    });
    
    $orderCtrl.click(cycleOrder);
    
    $teaserCtrl.click(function() {
      setExtended(!options.extended);
    });
    
    $proxyCtrl.click(function() {
      setProxy(!options.proxy);
    });
    
    $.extend(options, defaults, opts);
    
    loadSettings();
    loadFilters();
    
    bindGlobalShortcuts();
    
    setSize(options.thsize, true);
    setOrder(options.orderby, true);
    setExtended(options.extended, true);
  }
  
  fc.loadCatalog = function(c) {
    catalog = c;
    setProxy(options.proxy, true);
    setSSL(activeTheme.usessl);
    loadStorage();
    updateTime();
    $refresh[0].setAttribute('data-tip', $refresh[0].getAttribute('data-label')
      + ' ' + getDuration(catalog.delay, true));
    buildThreads();
    clearInterval(pulseInterval);
    pulseInterval = setInterval(updateTime, 10000);
  }
  
  function setSSL(val) {
    if (val === undefined) {
      return;
    }
    if (val) {
      catalog.server = catalog.server.replace(/^http:/, 'https:');
    }
    else {
      catalog.server = catalog.server.replace(/^https:/, 'http:');
    }
  }
  
  function getRegexSpecials() {
    var specials = ['/', '.', '*', '+', '?', '(', ')', '[', ']', '{', '}', '\\' ];
    return new RegExp('(\\' + specials.join('|\\') + ')', 'g');
  }
  
  function getThreadPage(tid) {
    return 0 | (catalog.order.alt.indexOf(tid) / options.threadsPerPage);
  }
  
  // Requires proper expiration headers
  function refreshWindow() {
    location.href = location.href;
  }
  
  function debounce(delay, fn) {
    var timeout;
    
    return function() {
      var args = arguments, context = this;
      
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }
  
  function focusQuickfilter() {
    var qf;
    
    if ($qfCtrl.hasClass('active')) {
      clearQuickfilter(true);
    }
    else {
      toggleQuickfilter();
    }
  }
  
  function toggleQuickfilter() {
    var qfcnt = document.getElementById('qf-cnt');
    if ($qfCtrl.hasClass('active')) {
      clearQuickfilter();
      qfcnt.style.display = 'none';
      $qfCtrl.removeClass('active');
      $('#qf-box').off('keyup').off('keydown')[0].blur();
    }
    else {
      qfcnt.style.display = 'inline';
      $('#qf-box')
        .keyup(debounce(250, applyQuickfilter))
        .keydown(function(e) {
          if (e.keyCode == '27') {
            toggleQuickfilter();
          }
        })
        .focus()[0].value = '';
      $qfCtrl.addClass('active');
    }
  }
  
  function applyQuickfilter() {
    var qfstr = document.getElementById('qf-box').value;
    if (qfstr != '') {
      var regexEscape = getRegexSpecials();
      qfstr = qfstr.replace(regexEscape, '\\$1');
      quickFilterPattern = new RegExp(qfstr, 'i');
      buildThreads();
    } else {
      clearQuickfilter();
    }
  }
  
  function clearQuickfilter(focus) {
    var qf = document.getElementById('qf-box')
    if (focus) {
      qf.value = '';
      qf.focus();
    }
    else {
      quickFilterPattern = false;
      buildThreads();
    }
  }
  
  function buildContextMenu() {
    var icon = ' icon="/favicon.ico"';
    
    ctxCmds = {
      clearpin: clearPinnedThreads,
      pin: toggleThreadPin,
      hide: toggleThreadHide,
      report: reportThread
    }
    
    document.getElementById('ctxmenu-main').innerHTML = 
      '<menuitem label="Unpin all threads" icon="/favicon.ico"></menuitem>';
    
    document.getElementById('ctxmenu-thread').innerHTML = 
      '<menuitem label="Pin/Unpin" data-cmd="pin"' + icon + '></menuitem>' +
      '<menuitem label="Hide" data-cmd="hide"' + icon + '></menuitem>' +
      '<menuitem label="Report" data-cmd="report"' + icon + '></menuitem>' +
      '<menuitem label="Unpin all" data-cmd="clearpin"' + icon + '></menuitem>';
    
    $('#ctxmenu-main').click(clearPinnedThreads);
    $('#ctxmenu-thread').click(onThreadContextClick);
  }
  
  function bindGlobalShortcuts() {
    var el, tid;
    if (hasWebStorage && hasNativeJSON) {
      $threads.on('mousedown', function(e) {
        el = e.target;
        if (el.className.indexOf('thumb') != -1) {
          tid = el.getAttribute('data-id');
          if (e.which == 3) {
            $threads[0].setAttribute('contextmenu', 'ctxmenu-thread');
            document.getElementById('ctxmenu-thread').target = tid;
          }
          else if ((e.altKey && !activeTheme.altKey)
            || (e.ctrlKey && activeTheme.altKey)) {
            toggleThreadPin(tid);
            return false;
          }
          else if (e.shiftKey) {
            toggleThreadHide(tid);
            return false;
          }
        }
        else if (e.which == 3) {
          $threads[0].setAttribute('contextmenu', 'ctxmenu-main');
        }
      });
    }
    if (!activeTheme.nobinds) {
      $(document).on('keyup', processKeybind);
    }
  }
  
  function toggleThreadPin(tid) {
    if (pinnedThreads[tid] >= 0) {
      delete pinnedThreads[tid];
    }
    else {
      pinnedThreads[tid] = catalog.threads[tid].r || 0;
    }
    localStorage.setItem('pin-' + catalog.slug, JSON.stringify(pinnedThreads));
    buildThreads();
  }
  
  function toggleThreadHide(tid) {
    hiddenThreads[tid] = true;
    localStorage.setItem('hide-' + catalog.slug, JSON.stringify(hiddenThreads));
    document.getElementById('thread-' + tid).style.display = 'none';
    ++hiddenThreadsCount;
    $hiddenCount[0].innerHTML = hiddenThreadsCount;
    $hiddenLabel.show();
  }
  
  function reportThread(tid) {
    window.open(
      'http://sys.4chan.org/' + catalog.slug +
      '/imgboard.php?mode=report&no=' + tid,
      Date.now(), 
      'toolbar=0,scrollbars=0,location=0,status=1,menubar=0,resizable=1,' +
      'width=660,height=192'
    );
  }
  
  function onThreadContextClick(e) {
    var cmd = e.target.getAttribute('data-cmd');
    ctxCmds[cmd](document.getElementById('ctxmenu-thread').target);
  }
  
  function processKeybind(e) {
    var el = e.target;
    if (el.nodeName == 'TEXTAREA' || el.nodeName == 'INPUT') {
      return;
    }
    if (keybinds[e.keyCode]) {
      keybinds[e.keyCode]();
    }
  }
  
  function clearHiddenThreads() {
    hiddenThreads = {};
    localStorage.removeItem('hide-' + catalog.slug);
    if (hiddenThreadsCount > 0) {
      buildThreads();
    }
    return false;
  }
  
  function clearPinnedThreads() {
    pinnedThreads = {};
    localStorage.removeItem('pin-' + catalog.slug);
    buildThreads();
    return false;
  }
  
  function toggleRadio() {
    var $this = $(this);
    if ($this.hasClass('active')) {
      $this.removeClass('active');
    }
    else {
      $this.parent().find('.active').removeClass('active');
      $this.addClass('active');
    }
  }
  
  function enableButton($el) {
    $el.addClass('active');
    if ($el.hasClass('clickbox')) {
      $el[0].innerHTML = '&#x2714;';
    }
  }
  
  function disableButton($el) {
    $el.removeClass('active');
    if ($el.hasClass('clickbox')) {
      $el[0].innerHTML = '';
    }
  }
  
  function toggleButton($el) {
    if ($el.hasClass('active')) {
      disableButton($el);
    }
    else {
      enableButton($el);
    }
  }
  
  function onThumbMouseIn() {
    var
      $this = $(this),
      oldWidth = this.offsetWidth,
      oldHeight = this.offsetHeight,
      newWidth, newHeight;
    
    $this.clone().insertAfter($this);
    
    $this.addClass('scaled');
    
    newWidth = this.offsetWidth;
    newHeight = this.offsetHeight;
    
    offsetX = (-(newWidth - oldWidth) / 2);
    offsetY = -(newHeight - oldHeight) / 2;
    
    this.style.marginLeft = offsetX + 'px';
    this.style.marginTop = offsetY + 'px';
  }
  
  function onThumbMouseOut() {
    var $this = $(this);
    $this.next().remove();
    
    $this.removeClass('scaled');
    this.style.marginLeft = '';
    this.style.marginTop = '';
  }
  
  // Generate the color palette for the filters
  function buildFilterPalette() {
    var
      $row,
      $palette = $('#filter-color-table').children('tbody'),
      rows = options.filterColors.length,
      cols = 0;
    
    if (rows > 0) {
      cols = options.filterColors[0].length;
      $('#filter-color-table').children('tfoot').find('td')
        .attr('colspan', cols);
    }
    for (var i = 0; i < rows; ++i) {
      $row = $(document.createElement('tr'));
      for (var j = 0; j < cols; ++j) {
        $row.append(
          $(document.createElement('td')).append(
            $(document.createElement('span')).attr('class', 'button clickbox')
            .css('background', options.filterColors[i][j])
            .click(selectFilterColor)
          )
        );
      }
      $palette.append($row);
    }
  }
  
  function showFilterPalette(e) {
    var pos = $(this).position();
    
    if (!$filterPalette) {
      $filterPalette = $('#filter-palette');
      buildFilterPalette();
    }
    
    $filterPalette.attr('data-target', e.data.fid);
    $filterPalette.css({
      'top': pos.top + 'px',
      'left': (pos.left - $filterPalette.width() - 20) + 'px'
    });
    
    $filterPalette.show();
  }
  
  function showFilters() {
    if (!hasWebStorage) {
      alert("Your browser doesn't support Local Storage");
      return;
    }
    if (!hasNativeJSON) {
      alert("Your browser doesn't support native JSON");
      return;
    }
    if ($filtersPanel.css('display') != 'none') {
      closeFilters();
      return;
    }
    if ($themePanel.css('display') == 'none') {
      $('#filters-close').click(closeFilters);
      
      $('#filters-add').click(addEmptyFilter);
      $('#filters-save').click(saveFilters);
      
      $('#filter-palette-close').click(closeFilterPalette);
      $('#filter-palette-clear').click(clearFilterColor);
      
      $('#filters-help-open').click(function() { $('#filters-protip').show(); });
      $('#filters-help-close').click(function() { $('#filters-protip').hide(); });
      
      var rawFilters = localStorage.getItem('filters'), filterId = 0;
      if (rawFilters) {
        rawFilters = $.parseJSON(rawFilters);
        for (var i in rawFilters) {
          $filterList.append(buildFilter(rawFilters[i], filterId));
          ++filterId;
        }
        updateFilterHitCount();
      }
      $filtersPanel.show();
    }
  }
  
  function closeFilters() {
    $('#filters-close').off('click');
    $('#filters-add').off('click');
    $('#filters-save').off('click');
    $('#filter-palette-close').off('click');
    $('#filter-palette-clear').off('click');
    $('#filters-help-open').off('click');
    $('#filters-help-close').off('click');
    
    $('#filters-msg').hide();
    $filtersPanel.hide();
    $filterList.children('tr').remove();
  }
  
  // Loads patterns from the localStorage and builds regexps
  loadFilters = function() {
    if (!hasWebStorage) return;
    
    activeFilters = {};
    
    var rawFilters = localStorage.getItem('filters');
    if (!rawFilters) return;
    
    rawFilters = $.parseJSON(rawFilters);
    
    var
      fid, v, w, wordcount,
      wordSepS, wordSepE, orJoin,
      regexType = /^\/(.*)\/(i?)$/,
      regexOrNorm = /\s*\|+\s*/g,
      regexWc = /\\\*/g, replWc = '[^\\s]*',
      regexEscape = getRegexSpecials(),
      match, inner, words, rawPattern, pattern, orOp, orCluster, type;
      
    wordSepS = '(?=.*\\b';
    wordSepE = '\\b)';
    
    try {
      for (fid in rawFilters) {
        if (rawFilters[fid].active && rawFilters[fid].pattern != '') {
          rawPattern = rawFilters[fid].pattern;
          if (rawPattern[0] == '#') {
            type = 1;
            pattern = new RegExp(rawPattern.slice(1).replace(regexEscape, '\\$1'));
          }
          else {
            type = 0;
            if (match = rawPattern.match(regexType)) {
              pattern = new RegExp(match[1], match[2]);
            }
            else if (rawPattern[0] == '"' && rawPattern[rawPattern.length - 1] == '"') {
              pattern = new RegExp(rawPattern.slice(1, -1).replace(regexEscape, '\\$1'));
            }
            else {
              words = rawPattern.replace(regexOrNorm, '|').split(' ');
              pattern = '';
              wordcount = words.length;
              if (false) {
                pattern = new RegExp(wordSepS + inner + wordSepE, 'i');
              }
              else {
                for (w = 0; w < wordcount; ++w) {
                  if (words[w].indexOf('|') != -1) {
                    orOp = words[w].split('|');
                    orCluster = [];
                    for (v = orOp.length - 1; v >= 0; v--) {
                      if (orOp[v] != '') {
                        orCluster.push(orOp[v].replace(regexEscape, '\\$1'));
                      }
                    }
                    inner = orCluster.join('|').replace(regexWc, replWc);
                    pattern += wordSepS + '(' + inner + ')' + wordSepE;
                  }
                  else {
                    inner = words[w].replace(regexEscape, '\\$1').replace(regexWc, replWc);
                    pattern += wordSepS + inner + wordSepE;
                  }
                }
                pattern = new RegExp('^' + pattern, 'i');
              }
            }
          }
          //console.log('Resulting regex: ' + pattern);
          activeFilters[fid] = {
            type: type,
            pattern: pattern,
            fid: fid,
            hidden: rawFilters[fid].hidden,
            color: rawFilters[fid].color,
            bright: rawFilters[fid].bright,
            top: rawFilters[fid].top,
            hits: 0
          };
        }
      }
    }
    catch (err) {
      alert('There was an error processing one of the filters: '
        + err + ' in: ' + rawPattern);
    }
  }
  
  function saveFilters() {
    var rawFilters = {}, $msg = $('#filters-msg');
    
    $filterList.children('tr').each(function(i, e) {
      var
        $cols = $(e).children('td'),
        $color = $($cols[2]).children('span'),
        f = {
          active: parseInt($($cols[0]).children('span').attr('data-active')),
          pattern: $($cols[1]).children('input').val(),
          hidden: parseInt($($cols[3]).children('span').attr('data-hide')),
          top: parseInt($($cols[4]).children('span').attr('data-top'))
        };
      if ($color.attr('data-nocolor') === undefined) {
        f.color = $color.css('background-color');
        if (getColorBrightness(f.color) > 125) {
          f.bright = true;
        }
      }
      rawFilters[i] = f;
    });
    
    if (rawFilters['0']) {
      localStorage.setItem('filters', JSON.stringify(rawFilters));
    }
    else {
      localStorage.removeItem('filters');
    }
    
    $msg.html('Done').attr('class', 'msg-ok').show().delay(2000).fadeOut(500);
    
    loadFilters();
    buildThreads();
    updateFilterHitCount();
  }
  
  function filterSetCustomColor() {
    var $this = $(this);
    if ($this.val().search(/^[A-F0-9]{6}$/i) != -1) {
      $filterRgbOk.css({ visibility: 'visible', background: '#' + $this.val() });
    }
    else {
      $filterRgbOk.css({ visibility: 'hidden' });
    }
  }
  
  function closeFilterPalette() {
    $filterPalette.hide();
  }
  
  function buildFilter(filter, id) {
    var td, span, tr, input, cls;
    
    tr = document.createElement('tr');
    tr.id = 'filter-' + id;
    
    // On
    td = document.createElement('td');
    span = document.createElement('span');
    span.setAttribute('data-active', filter.active);
    cls = 'button clickbox';
    if (filter.active) {
      cls += ' active';
      span.innerHTML = '&#x2714;';
    }
    span.setAttribute('class', cls);
    $(span).on('click', {type: 'active'}, toggleFilter);
    td.appendChild(span);
    tr.appendChild(td);
    
    // Pattern
    td = document.createElement('td');
    input = document.createElement('input');
    input.type = 'text';
    input.value = filter.pattern;
    td.appendChild(input);
    tr.appendChild(td);
    
    // Color
    td = document.createElement('td');
    span = document.createElement('span');
    span.id = 'filter-color-' + id
    span.setAttribute('class', 'button clickbox');
    if (!filter.color) {
      span.setAttribute('data-nocolor', '1');
      span.innerHTML = '&#x2215;';
    }
    else {
      span.style.background = filter.color;
    }
    $(span).on('click', {fid: id}, showFilterPalette);
    td.appendChild(span);
    tr.appendChild(td);
    
    // Hide
    td = document.createElement('td');
    span = document.createElement('span');
    cls = 'button clickbox filter-hide';
    span.setAttribute('data-hide', filter.hidden);
    if (filter.hidden) {
      cls += ' active';
      span.innerHTML = '&#x2714;';
    }
    span.setAttribute('class', cls);
    $(span).on('click', {type: 'hide', xor: 'top'}, toggleFilter);
    td.appendChild(span);
    tr.appendChild(td);
    
    // Top
    td = document.createElement('td');
    span = document.createElement('span');
    cls = 'button clickbox filter-top';
    span.setAttribute('data-top', filter.top);
    if (filter.top) {
      cls += ' active';
      span.innerHTML = '&#x2714;';
    }
    span.setAttribute('class', cls);
    $(span).on('click', {type: 'top', xor: 'hide'}, toggleFilter);
    td.appendChild(span);
    tr.appendChild(td);
    
    // Del
    td = document.createElement('td');
    span = document.createElement('span');
    span.setAttribute('data-target', id);
    span.setAttribute('class', 'button clickbox');
    span.innerHTML = '&#x2716;';
    $(span).on('click', deleteFilter)
    td.appendChild(span);
    tr.appendChild(td);
    
    // Match count
    td = document.createElement('td');
    td.id = 'fhc-' + id;
    tr.appendChild(td);
    
    return tr;
  }
  
  function selectFilterColor(clear) {
    var $target = $('#filter-color-' + $filterPalette.attr('data-target'));
    if (clear === true) {
      $target.attr('data-nocolor', '1')
        .html('&#x2215;')
        .css('background', '');
    }
    else {
      $target.removeAttr('data-nocolor')
        .html('').css('background', $(this).css('background-color'));
    }
    closeFilterPalette();
  }
  
  function clearFilterColor() {
    selectFilterColor(true);
  }
  
  function getColorBrightness(color) {
    var components, r, g, b;
    if (color[0] == '#') {
      components = color.substring(1)
        .replace(/([0-9A-F]{2})/ig, '0x$1,').split(',');
    }
    else {
      components = color.replace(/[^0-9,]+/g, '').split(',');
    }
    r = parseInt(components[0]);
    g = parseInt(components[1]);
    b = parseInt(components[2]);
    return ((r * 0.299) + (g * 0.587) + (b * 0.114));
  }
  
  function addEmptyFilter() {
    $filterList[0].appendChild(buildFilter(baseFilter, getNextFilterId()));
  }
  
  function getNextFilterId() {
    var len, tmp = $filterList[0].getElementsByTagName('tr');
    if (!(len = tmp.length)) {
      return 0;
    }
    else {
      return tmp[len - 1].getAttribute('id').slice(7) + 1;
    }
  }
  
  function deleteFilter() {
    $('#filter-' + $(this).attr('data-target')).remove();
  }
  
  function toggleFilter(e) {
    var $this = $(this), attr = 'data-' + e.data.type, xorEle;
    
    if ($this.attr(attr) == '0') {
      $this.attr(attr, '1').addClass('active')[0].innerHTML = '&#x2714;';
      if (e.data.xor) {
        xorEle = $this.parent().parent().find('.filter-' + e.data.xor)
          .attr('data-'  + e.data.xor, '0').removeClass('active')[0]
            .innerHTML = '';
      }
    }
    else {
      $this.attr(attr, '0').removeClass('active')[0].innerHTML = '';
    }
  }
  
  function updateFilterHitCount() {
    var i, rows = $filterList[0].getElementsByTagName('tr');
    for (i = 0, j = rows.length; i < j; ++i) {
      document.getElementById('fhc-' + rows[i].id.slice(7))
        .innerHTML = activeFilters[i] ? '&times;' + activeFilters[i].hits : '';
    }
  }
  
  function showThemeEditor() {
    if (!hasWebStorage) {
      alert("Your browser doesn't support Local Storage");
      return;
    }
    
    if (!hasNativeJSON) {
      alert("Your browser doesn't support native JSON");
      return;
    }
    
    if ($themePanel.css('display') != 'none') {
      closeThemeEditor();
      return;
    }
    
    if ($filtersPanel.css('display') == 'none') {
      var
        buttons = ['notipsy', 'magnify', 'altKey', 'nobinds', 'usessl'],
        ss, field,
        theme = localStorage.getItem('theme');
      
      theme = theme ? JSON.parse(theme) : {};
      
      for (var i = buttons.length - 1; i >= 0; i--) {
        if (theme[buttons[i]]) {
          enableButton($('#theme-' + buttons[i]));
        }
        else {
          disableButton($('#theme-' + buttons[i]));
        }
      }
      
      if (theme.menu && (field = document.getElementById('theme-menu'))) {
        field.value = theme.menu;
      }
      
      if (theme.ss) {
        ss = document.getElementById('theme-ss');
        theme.ss = theme.ss.split('.')[0];
        for (var i = ss.options.length - 1; i >= 0; i--) {
          if (ss.options[i].value == theme.ss) {
            ss.selectedIndex = i;
            break;
          }
        }
      }
      
      if (theme.css) {
        document.getElementById('theme-css').value = theme.css;
      }
      
      $('#theme-' + buttons.join(', #theme-'))
        .click(function() { toggleButton($(this)) });
      
      $('#theme-save').click(saveTheme);
      $('#theme-close').click(closeThemeEditor);
        
      $('#theme-msg').hide();
      $themePanel.show();
    }
  }
  
  function closeThemeEditor() {    
    var buttons =
      ['save', 'close', 'notipsy', 'magnify', 'altKey', 'nobinds', 'usessl'];
    
    $('#theme-' + buttons.join(', #theme-')).off('click');
    $themePanel.hide();
  }
  
  function resetCustomMenu() {
    var i, j, nav, slugs, more;
    
    if (!document.getElementsByClassName) {
      return;
    }
    
    nav = document.getElementById('topnav');
    nav.style.display = 'none';
    
    slugs = nav.getElementsByClassName('slug');
    
    for (i = 0, j = slugs.length; i < j; ++i) {
      slugs[i].style.display = 'inline';
    }
    
    if (more = document.getElementById('more-slugs-btn')) {
      more.style.display = 'none';
      more.removeEventListener('click', resetCustomMenu, false);
    }
    
    nav.style.display = 'block';
  }
  
  function loadTheme() {
    if (!hasWebStorage) return;
    
    var customTheme = localStorage.getItem('theme');
    
    if (!customTheme) return;
    
    activeTheme = $.parseJSON(customTheme);
  }
  
  function applyTheme(customTheme, nocss) {
    var i, j, head, header, nav, slugs, slughash, hasHidden, style, link, more;
    
    if (customTheme.menu) {
      if (document.getElementsByClassName) {
        slugs = customTheme.menu.split(' ');
        slughash = {};
        for (i = 0, j = slugs.length; i < j; ++i) {
          slughash['/' + slugs[i] + '/'] = true;
        }
        
        nav = document.getElementById('topnav');
        nav.style.display = 'none';
        
        slugs = nav.getElementsByClassName('slug');
        
        for (i = 0, j = slugs.length; i < j; ++i) {
          if (!slughash[slugs[i].firstChild.textContent]) {
            slugs[i].style.display = 'none';
            hasHidden = true;
          }
          else {
            slugs[i].style.display = 'inline';
          }
        }
        
        if (more = document.getElementById('more-slugs-btn')) {
          if (hasHidden) {
            more.addEventListener('click', resetCustomMenu, false);
            more.style.display = 'inline';
          }
          else {
            more.style.display = 'none';
          }
        }
        
        nav.style.display = 'block';
      }
    }
    else if (customTheme.menu != activeTheme.menu) {
      resetCustomMenu();
    }
    
    if (customTheme.notipsy) {
      if (customTheme.notipsy != activeTheme.notipsy) {
        $thumbs
          .off('mouseenter.tipsy')
          .off('mouseleave.tipsy');
      }
    }
    else {
      if (customTheme.notipsy != activeTheme.notipsy ) {
        $thumbs.tipsy(tipopts);
      }
    }
    
    if (customTheme.magnify) {
      if (activeTheme.magnify != customTheme.magnify
          && options.thsize == 'small') {
        $thumbs
          .on('mouseenter.scale', onThumbMouseIn)
          .on('mouseleave.scale', onThumbMouseOut);
      }
    }
    else {
      if (activeTheme.magnify != customTheme.magnify) {
        $thumbs
          .off('mouseenter.scale')
          .off('mouseleave.scale');
      }
    }
    
    if (customTheme.nobinds) {
      if (activeTheme.nobinds != customTheme.nobinds) {
        $(document).off('keyup', processKeybind);
      }
    }
    else {
      if (activeTheme.nobinds != customTheme.nobinds) {
        $(document).on('keyup', processKeybind);
      }
    }
    
    if (!nocss) {
      fc.applyCSS(customTheme);
    }
  }
  
  fc.applyCSS = function(customTheme) {
    var head, link, style;
    
    if (!customTheme) {
      customTheme = activeTheme;
    }
    
    head = document.head || document.getElementsByTagName('head')[0];
    
    if (customTheme.ss) {
      if (!(link = document.getElementById('preset-css'))) {
        link = document.createElement('link');
        link.type = 'text/css';
        link.rel = 'stylesheet';
        link.id = 'preset-css';
        link.href = '/stylesheets/' + customTheme.ss;
        head.insertBefore(link, document.getElementById('base-css').nextSibling);
      }
      else {
        link.href = '/stylesheets/' + customTheme.ss;
      }
    }
    else {
      if (activeTheme.ss != customTheme.ss) {
        head.removeChild(document.getElementById('preset-css'));
      }
    }
    
    if (style = document.getElementById('custom-css')) {
      head.removeChild(style);
    }
    
    if (customTheme.css) {
      style = document.createElement('style');
      style.type = 'text/css';
      style.id = 'custom-css';
      
      if (style.styleSheet) {
        style.styleSheet.cssText = customTheme.css;
      }
      else {
        style.innerHTML = customTheme.css;
      }
      // Allows to add in-page css inside a style tag with 'event-css' as id
      head.insertBefore(style, document.getElementById('event-css'));
    }
  }
  
  // Applies and saves the theme to localStorage
  function saveTheme() {
    var ss, field, css, style, customTheme = {};
    
    if ($('#theme-notipsy').hasClass('active')) {
      customTheme.notipsy = true;
    }
    
    if ($('#theme-magnify').hasClass('active')) {
      customTheme.magnify = true;
    }
    
    if ($('#theme-altKey').hasClass('active')) {
      customTheme.altKey = true;
    }
    
    if ($('#theme-nobinds').hasClass('active')) {
      customTheme.nobinds = true;
    }
    
    if ($('#theme-usessl').hasClass('active')) {
      customTheme.usessl = true;
    }
    if (customTheme.usessl != activeTheme.usessl) {
      setSSL(!!customTheme.usessl);
      buildThreads();
    }
    
    ss = document.getElementById('theme-ss');
    if (ss.value != '0') {
      customTheme.ss = ss.value + '.css?' + 
        ss.options[ss.selectedIndex].getAttribute('data-version');
    }
    
    field = document.getElementById('theme-menu');
    if (field && (field.value != '')) {
      customTheme.menu = field.value;
    }
    
    if ((css = document.getElementById('theme-css').value) != '') {
      customTheme.css = css;
    }
    
    applyTheme(customTheme);
    
    localStorage.removeItem('theme');
    
    for (var i in customTheme) {
      localStorage.setItem('theme', JSON.stringify(customTheme));
      break;
    }
    
    activeTheme = customTheme;
    
    $('#theme-msg')
      .html('Theme saved')
      .attr('class', 'msg-ok')
      .show().delay(2000).fadeOut(500);
  }
  
  // Loads threads from local storage
  function loadThreadList(key) {
    var i, threads, mod = false, ft = catalog.order.date[0];
    if (threads = localStorage.getItem(key)) {
      threads = JSON.parse(threads);
      for (i in threads) {
        if (!catalog.threads[i] && i < ft) {
          delete threads[i];
          mod = true;
        }
      }
      for (i in threads) {
        if (mod) { localStorage.setItem(key, JSON.stringify(threads)); }
        return threads;
      }
      localStorage.removeItem(key);
    }
    return {};
  }
  
  // Loads data from webStorage
  loadStorage = function() {
    if (hasWebStorage && hasNativeJSON) {
      hiddenThreads = loadThreadList('hide-' + catalog.slug);
      pinnedThreads = loadThreadList('pin-' + catalog.slug);
    }
  }
  
  // Loads basic settings from localStorage
  loadSettings = function() {
    var settings;
    if (hasWebStorage && hasNativeJSON
      && (settings = localStorage.getItem('settings'))) {
      $.extend(options, JSON.parse(settings));
    }
    else {
      $.extend(options, defaults);
    }
  }    
  
  // Saves basic settings to localStorage
  function saveSettings() {
    var i, key, settings;
    if (!hasWebStorage || !hasNativeJSON) {
      return;
    }
    settings = {};
    for (i = basicSettings.length - 1; i >= 0; i--) {
      key = basicSettings[i];
      if (options[key] != defaults[key]) {
        settings[key] = options[key];
      }
    }
    for (i in settings) {
      localStorage.setItem('settings', JSON.stringify(settings));
      return;
    }
    localStorage.removeItem('settings');
  }
  
  setSize = function(size, init) {
    var cls;
    if (size == 'small') {
      $sizeCtrl.html($sizeCtrl.attr('data-lbl-large'));
      cls = 'small';
      if ($thumbs && activeTheme.magnify) {
        $thumbs
          .on('mouseenter.scale', onThumbMouseIn)
          .on('mouseleave.scale', onThumbMouseOut);
      }
      options.thsize = 'small';
    }
    else {
      $sizeCtrl.html($sizeCtrl.attr('data-lbl-small'));
      cls = 'large';
      if ($thumbs && activeTheme.magnify) {
        $thumbs
          .off('mouseenter.scale')
          .off('mouseleave.scale');
      }
      options.thsize = 'large';
    }
    if (options.extended) {
      cls = 'extended-' + cls;
    }
    $threads.attr('class', cls);
    if (!init) {
      saveSettings();
    }
  }
  
  setExtended = function(mode, init) {
    var cls = '';
    if (mode) {
      $teaserCtrl.html($teaserCtrl.attr('data-lbl-hide'));
      $('.teaser').css('display', 'block');
      cls = 'extended-';
      options.extended = true;
    }
    else {
      $teaserCtrl.html($teaserCtrl.attr('data-lbl-show'));
      $('.teaser').css('display', 'none');
      options.extended = false;
    }
    cls += options.thsize;
    $threads.attr('class', cls);
    if (!init) {
      saveSettings();
    }
  }
  
  setProxy = function(mode, init) {
    if (!catalog.proxy) {
      $proxyCtrl.hide();
      return;
    }
    if (mode) {
      $proxyCtrl.addClass('active');
      options.proxy = true;
    }
    else {
      $proxyCtrl.removeClass('active');
      options.proxy = false;
    }
    if (!init) {
      saveSettings();
      buildThreads();
    }
  }
  
  setOrder = function(order, init) {
    var lbl = document.getElementById('ordered-by');
    if (order == 'date') {
      $orderCtrl.html($orderCtrl.attr('data-lbl-alt'));
      lbl.innerHTML = 'creation date';
      options.orderby = 'date';
    }
    else if (order == 'alt') {
      $orderCtrl.html($orderCtrl.attr('data-lbl-r'));
      lbl.innerHTML = 'bump date';
      options.orderby = 'alt';
    }
    else {
      $orderCtrl.html($orderCtrl.attr('data-lbl-date'));
      lbl.innerHTML = 'reply count';
      options.orderby = 'r';
    }
    if (!init) {
      saveSettings();
      buildThreads();
    }
  }
  
  function cycleOrder() {
    if (options.orderby == 'date') {
      setOrder('alt');
    }
    else if (options.orderby == 'alt') {
      setOrder('r');
    }
    else {
      setOrder('date');
    }
  }
  
  buildThreads = function() {
    var
      tip, i, j, fid, id, entry, thread, af, hl, onTop, pinned, provider,
      rDiff, onPage, filtered = 0, html = '';
    
    if ($threads[0].hasChildNodes()) {
      tip = document.getElementById('th-tip');
      if (tip) {
        document.body.removeChild(tip);
      }
      $threads.empty();
    }
    
    if (catalog.count == 0) {
      $threads.html('Empty threadlist').css('text-align', 'center');
      return;
    }
    
    if (options.proxy && catalog.proxy) {
      provider = catalog.proxy;
    }
    else {
      provider = catalog.server + 'res/';
    }
    
    hiddenThreadsCount = 0;
    
    for (fid in activeFilters) {
      activeFilters[fid].hits = 0;
    }
    
    threadloop: for (i = 0; i < catalog.count; ++i) {
      id = catalog.order[options.orderby][i];
      entry = catalog.threads[id];
      hl = onTop = pinned = false;
      if(!quickFilterPattern) {
        if (hiddenThreads[id]) {
          ++hiddenThreadsCount;
          continue;
        }
        if (pinnedThreads[id] >= 0) {
          pinned = onTop = true;
        }
        else {
          for (fid in activeFilters) {
            af = activeFilters[fid];
            if ((af.type == 0 && af.pattern.test(entry.teaser))
              || (af.type == 1 && af.pattern.test(entry.author))) {
              if (af.hidden) {
                ++filtered;
                af.hits += 1;
                continue threadloop;
              }
              hl = af;
              onTop = !!af.top;
              af.hits += 1;
              break;
            }
          }
        }
      }
      else if (!quickFilterPattern.test(entry.teaser)) {
        continue;
      }
      thread = '<div id="thread-' + id
      + '" class="thread"><a target="_blank" href="'
      + provider + id + '"><img alt="" id="thumb-'
      + id + '" class="thumb';
      
      if (hl.color) {
        thread += ' hl" style="border-color: ' + hl.color;
      }
      else if (pinned) {
        thread += ' pinned';
      }
      thread += '" src="' + options.contentUrl
      + (entry.s ?
        ('images/' + entry.s) :
        (catalog.slug + '/src/' + id + '.jpg')
        ) + '" data-id="' + id + '" /></a>';
      
      if (catalog.flags) {
        thread += '<div class="flag flag-' + entry.loc + '" title="'
        + entry.locname + '"></div>';
      }
      
      thread += '<div title="(R)eplies / (I)mages'
        + (onTop ? ' / (P)age' : '') + '" id="meta-' + id + '" class="meta">';
      
      if (entry.r) {
        thread += 'R:<b>' + entry.r + '</b>';
        if (pinned) {
          rDiff = entry.r - pinnedThreads[id];
          if (rDiff > 0) {
            thread += ' (+' + rDiff + ')';
            pinnedThreads[id] = entry.r;
          }
          else {
            thread += '(+0)';
          }
        }
        if (entry.i) {
          thread += ' / I:<b>' + entry.i + '</b>';
        }
      }
      
      if (onTop && (page = getThreadPage(id)) >= 0) {
        if (entry.r) {
          thread += ' / ';
        }
        thread += 'P:<b>' + page + '</b>';
      }
      
      thread += '</div>';
      
      if (entry.teaser) {
        thread += '<div class="teaser';
        if (hl.color) {
          if (hl.bright) {
            thread += ' hl-high"';
          }
          else {
            thread += ' hl-low"';
          }
          thread += ' style="color:' + hl.color;
        }
        thread += '">' + entry.teaser + '</div>';
      }
      
      if (onTop) {
        html = thread + '</div>' + html;
      }
      else {
        html += thread + '</div>';
      }
    }
    html += '<div class="clear"></div>';
    
    for (j in pinnedThreads) {
      localStorage.setItem('pin-' + catalog.slug, JSON.stringify(pinnedThreads));
      break;
    }
    
    $threads[0].innerHTML = html;
    $thumbs = $threads.find('.thumb');
    
    if (options.thsize == 'small' && activeTheme.magnify) {
      $thumbs
        .on('mouseenter.scale', onThumbMouseIn)
        .on('mouseleave.scale', onThumbMouseOut);
    }
    
    if (!activeTheme.notipsy) {
      $thumbs.tipsy(tipopts);
    }
    
    if (filtered > 0) {
      $filteredCount.html(filtered);
      $filteredLabel.show();
    }
    else {
      $filteredLabel.hide();
    }
    
    if (hiddenThreadsCount > 0) {
      $hiddenCount.html(hiddenThreadsCount)
      $hiddenLabel.show();
    }
    else {
      $hiddenLabel.hide();
    }
  }
  
  // Updates the 'Refreshed ago' counter
  function updateTime() {
    var delta = (new Date().getTime() / 1000) - catalog.mtime;
    if (delta > 300) {
      clearInterval(pulseInterval);
      pulseInterval = setInterval(updateTime, 60000);
    }
    document.getElementById('updated').innerHTML = getDuration(delta, true);
  }
  
  // Tipsy tooltip callback
  function tipCb() {
    var tip, thread;
    
    thread = catalog.threads[this.getAttribute('data-id')];
    tip = 'Posted by <em>' + (thread.author ? thread.author : catalog.anon) + '</em> ';
    tip += getDuration((new Date().getTime() / 1000) - thread.date) + ' ago';
    
    if (!options.extended && thread.teaser) {
      tip += '<br />' + thread.teaser;
    }
    
    return tip;
  }
  
  function getDuration(delta, precise) {
    var count, head, tail;
    if (delta < 2) {
      return 'less than a second';
    }
    if (precise && delta < 300) {
      return (0 | delta) + ' seconds';
    }
    if (delta < 60) {
      return (0 | delta) + ' seconds';
    }
    if (delta < 3600) {
      count = 0 | (delta / 60);
      if (count > 1) {
        return count + ' minutes';
      }
      else {
        return 'one minute';
      }
    }
    if (delta < 86400) {
      count = 0 | (delta / 3600);
      if (count > 1) {
        head = count + ' hours';
      }
      else {
        head = 'one hour';
      }
      tail = 0 | (delta / 60 - count * 60);
      if (tail > 1) {
        head += ' and ' + tail + ' minutes';
      }
      return head;
    }
    count = 0 | (delta / 86400);
    if (count > 1) {
      head = count + ' days';
    }
    else {
      head = 'one day';
    }
    tail = 0 | (delta / 3600 - count * 24);
    if (tail > 1) {
      head += ' and ' + tail + ' hours';
    }
    return head;
  }
};

/*!
tipsy tooltips
(c) 2008-2010 jason frame [jason@onehackoranother.com]
released under the MIT license
*/
(function($) {
  
  function maybeCall(thing, ctx) {
    return (typeof thing == 'function') ? (thing.call(ctx)) : thing;
  };
  
  function Tipsy(element, options) {
    this.$element = $(element);
    this.options = options;
    this.enabled = true;
  };
  
  Tipsy.prototype = {
    show: function() {
      var title = this.getTitle();
      if (title && this.enabled) {
        var $tip = this.tip();
        
        $tip.find('.tipsy-inner')[this.options.html ? 'html' : 'text'](title);
        $tip[0].className = 'tipsy'; // reset classname in case of dynamic gravity
        $tip.remove()
          .css({top: 0, left: 0, visibility: 'hidden', display: 'block'})
          .prependTo(document.body);
        
        var pos = {
          top: this.$element[0].offsetTop
            + ((this.$element[0].offsetParent === null)
              ? 0 : this.$element[0].offsetParent.offsetTop),
          left: this.$element[0].offsetLeft
            + ((this.$element[0].offsetParent === null)
              ? 0 : this.$element[0].offsetParent.offsetLeft),
          width: this.$element[0].offsetWidth,
          height: this.$element[0].offsetHeight
        };
        
        var actualWidth = $tip[0].offsetWidth,
          actualHeight = $tip[0].offsetHeight,
          gravity = maybeCall(this.options.gravity, this.$element[0]);
        
        var tp;
        switch (gravity.charAt(0)) {
          case 'n':
            tp = {
              top: pos.top + pos.height + this.options.offset,
              left: pos.left + pos.width / 2 - actualWidth / 2
            };
            break;
          case 's':
            tp = {
              top: pos.top - actualHeight - this.options.offset,
              left: pos.left + pos.width / 2 - actualWidth / 2
            };
            break;
          case 'e':
            tp = {
              top: pos.top + pos.height / 2 - actualHeight / 2,
              left: pos.left - actualWidth - this.options.offset
            };
            break;
          case 'w':
            tp = {
              top: pos.top + pos.height / 2 - actualHeight / 2,
              left: pos.left + pos.width + this.options.offset
            };
            break;
        }
        
        if (tp.top <= 0) {
          return;
        }
        
        if (gravity.length == 2) {
          if (gravity.charAt(1) == 'w') {
            tp.left = pos.left + pos.width / 2 - 15;
          } else {
            tp.left = pos.left + pos.width / 2 - actualWidth + 15;
          }
        }
        
        $tip.css(tp).addClass('tipsy-' + gravity);
        $tip.find('.tipsy-arrow')[0].className = 'tipsy-arrow tipsy-arrow-' + gravity.charAt(0);
        if (this.options.className) {
          $tip.addClass(maybeCall(this.options.className, this.$element[0]));
        }
        if (this.options.id) {
          $tip[0].id = this.options.id;
        }
        if (this.options.fade) {
          $tip.stop()
            .css({opacity: 0, display: 'block', visibility: 'visible'})
            .animate({opacity: this.options.opacity});
        } else {
          $tip.css({visibility: 'visible', opacity: this.options.opacity});
        }
      }
    },
    
    hide: function() {
      if (this.options.fade) {
        this.tip().stop().fadeOut(function() { $(this).remove(); });
      } else {
        this.tip().remove();
      }
    },
    
    getTitle: function() {
      var title, $e = this.$element, o = this.options;
      var title, o = this.options;
      if (typeof o.title == 'string') {
        title = $e[0].getAttribute(o.title);
      } else if (typeof o.title == 'function') {
        title = o.title.call($e[0]);
      }
      return title || o.fallback;
    },
    
    tip: function() {
      if (!this.$tip) {
        this.$tip = document.createElement('div');
        this.$tip.setAttribute('class', 'tipsy');
        this.$tip.innerHTML = '<div class="tipsy-arrow"></div><div class="tipsy-inner"></div>';
        this.$tip = $(this.$tip);
      }
      return this.$tip;
    },
    
    validate: function() {
      if (!this.$element[0].parentNode) {
        this.hide();
        this.$element = null;
        this.options = null;
      }
    },
    
    enable: function() { this.enabled = true; },
    disable: function() { this.enabled = false; },
    toggleEnabled: function() { this.enabled = !this.enabled; }
  };
  
  $.fn.tipsy = function(options) {
    
    if (options === true) {
      return this.data('tipsy');
    } else if (typeof options == 'string') {
      var tipsy = this.data('tipsy');
      if (tipsy) tipsy[options]();
      return this;
    }
    
    options = $.extend({}, $.fn.tipsy.defaults, options);
    
    function get(ele) {
      var tipsy = $.data(ele, 'tipsy');
      if (!tipsy) {
        tipsy = new Tipsy(ele, $.fn.tipsy.elementOptions(ele, options));
        $.data(ele, 'tipsy', tipsy);
      }
      return tipsy;
    }
    
    function enter() {
      var tipsy = get(this);
      tipsy.hoverState = 'in';
      if (options.delayIn == 0) {
        tipsy.show();
      } else {
        //tipsy.fixTitle();
        setTimeout(
          function() { if (tipsy.hoverState == 'in') tipsy.show(); },
          options.delayIn
        );
      }
    };
    
    function leave() {
      var tipsy = get(this);
      tipsy.hoverState = 'out';
      if (options.delayOut == 0) {
        tipsy.hide();
      } else {
        setTimeout(
          function() { if (tipsy.hoverState == 'out') tipsy.hide(); },
          options.delayOut
        );
      }
    };
    
    this.each(function() { get(this); });
    
    if (options.trigger != 'manual') {
      var
        eventIn  = options.trigger == 'hover' ? 'mouseenter.tipsy' : 'focus',
        eventOut = options.trigger == 'hover' ? 'mouseleave.tipsy' : 'blur';
      this.on(eventIn, enter).on(eventOut, leave);
    }
    
    return this;
    
  };
  
  $.fn.tipsy.defaults = {
    id: null,
    className: null,
    delayIn: 250,
    delayOut: 0,
    fade: false,
    fallback: '',
    gravity: 's',
    html: false,
    offset: 0,
    opacity: 1.0,
    title: 'data-tip',
    trigger: 'hover'
  };
  
  $.fn.tipsy.elementOptions = function(ele, options) {
    return $.metadata ? $.extend({}, options, $(ele).metadata()) : options;
  };
  
  $.fn.tipsy.autoNS = function() {
    return $(this).offset().top > ($(document).scrollTop() + $(window).height() / 2) ? 's' : 'n';
  };
  
  $.fn.tipsy.autoWE = function() {
    return $(this).offset().left > ($(document).scrollLeft() + $(window).width() / 2) ? 'e' : 'w';
  };

   $.fn.tipsy.autoBounds = function(margin, prefer) {
    return function() {
      var dir = {ns: prefer[0], ew: (prefer.length > 1 ? prefer[1] : false)},
        boundTop = $(document).scrollTop() + margin,
        boundLeft = $(document).scrollLeft() + margin,
        $this = $(this);

      if ($this.offset().top < boundTop) dir.ns = 'n';
      if ($this.offset().left < boundLeft) dir.ew = 'w';
      if ($(window).width() + $(document).scrollLeft() - $this.offset().left < margin) dir.ew = 'e';
      if ($(window).height() + $(document).scrollTop() - $this.offset().top < margin) dir.ns = 's';

      return dir.ns + (dir.ew ? dir.ew : '');
    }
  };
  
})(jQuery);
