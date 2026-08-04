(function () {
  "use strict";

  var NAME = "mo-news-substack-newsletter-collection";
  var SELECTOR = '[data-wm-plugin="' + NAME + '"]';
  var EVENT_PREFIX = "moNewsSubstackNewsletterCollection";
  var instances = new WeakMap();

  var defaults = {
    apiBase: "https://mo-news-widgets-cdn-production.willmyers.workers.dev",
    collectionId: "j579rrkbj4wte5aazer765x9x983mtk3",
    fetchLimit: 100,
    pageSize: 9,
    kicker: "From the Mo News desk",
    heading: "Newsletter archive",
    searchPlaceholder: "Search newsletters",
    openInNewTab: true
  };

  function emit(element, name, detail) {
    element.dispatchEvent(new CustomEvent(EVENT_PREFIX + ":" + name, {
      bubbles: true,
      detail: detail || {}
    }));
  }

  function clampInteger(value, fallback, minimum, maximum) {
    var number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(Math.max(number, minimum), maximum);
  }

  function parseBoolean(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    return !/^(false|0|no)$/i.test(String(value));
  }

  function readSettings(element) {
    var siteSettings = window.MONewsSubstackNewsletterCollectionSettings || {};
    var settings = Object.assign({}, defaults, siteSettings);

    settings.apiBase = element.dataset.apiBase || settings.apiBase;
    settings.collectionId = element.dataset.collectionId || settings.collectionId;
    settings.kicker = element.dataset.kicker || settings.kicker;
    settings.heading = element.dataset.heading || settings.heading;
    settings.searchPlaceholder = element.dataset.searchPlaceholder || settings.searchPlaceholder;
    settings.fetchLimit = clampInteger(
      element.dataset.fetchLimit || settings.fetchLimit,
      defaults.fetchLimit,
      1,
      500
    );
    settings.pageSize = clampInteger(
      element.dataset.pageSize || settings.pageSize,
      defaults.pageSize,
      1,
      50
    );
    settings.openInNewTab = parseBoolean(
      element.dataset.openInNewTab,
      parseBoolean(settings.openInNewTab, defaults.openInNewTab)
    );
    settings.apiBase = String(settings.apiBase).replace(/\/+$/, "");

    return settings;
  }

  function decodeEntities(value) {
    var textarea = document.createElement("textarea");
    textarea.innerHTML = String(value || "");
    return textarea.value;
  }

  function normalizeItem(item) {
    var publishedAt = Number(item && item.publishedAt);
    var sourceData = (item && item.sourceData) || {};
    var thumbnailUrl = String((item && item.thumbnailUrl) || sourceData.enclosureUrl || "");
    try {
      var parsedThumbnailUrl = new URL(thumbnailUrl);
      if (!/^https?:$/.test(parsedThumbnailUrl.protocol)) thumbnailUrl = "";
    } catch (_error) {
      thumbnailUrl = "";
    }
    return {
      id: String((item && item.id) || ""),
      title: decodeEntities((item && item.title) || "Untitled newsletter"),
      summary: decodeEntities((item && item.summary) || ""),
      thumbnailUrl: thumbnailUrl,
      canonicalUrl: String((item && item.canonicalUrl) || ""),
      publishedAt: Number.isFinite(publishedAt) ? publishedAt : 0,
      searchText: [item && item.title, item && item.summary, item && item.bodyPlainText]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
    };
  }

  function createElement(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function formatDate(timestamp) {
    if (!timestamp) return "Date unavailable";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date(timestamp));
  }

  function renderShell(instance) {
    var element = instance.element;
    var settings = instance.settings;

    element.replaceChildren();
    element.classList.add("mo-newsletters");
    element.setAttribute("aria-busy", "true");

    var header = createElement("header", "mo-newsletters__header");
    var titleGroup = createElement("div", "mo-newsletters__title-group");
    var kicker = createElement("p", "mo-newsletters__kicker", settings.kicker);
    var heading = createElement("h2", "mo-newsletters__heading", settings.heading);
    var headingId = NAME + "-heading-" + instance.id;
    heading.id = headingId;
    element.setAttribute("aria-labelledby", headingId);
    titleGroup.append(kicker, heading);

    var search = createElement("div", "mo-newsletters__search");
    var label = createElement("label", "mo-newsletters__search-label", "Search the archive");
    var input = createElement("input", "mo-newsletters__search-input");
    var inputId = NAME + "-search-" + instance.id;
    label.htmlFor = inputId;
    input.id = inputId;
    input.type = "search";
    input.placeholder = settings.searchPlaceholder;
    input.autocomplete = "off";
    input.setAttribute("aria-controls", NAME + "-results-" + instance.id);
    search.append(label, input);
    header.append(titleGroup, search);

    var meta = createElement("div", "mo-newsletters__meta");
    var status = createElement("p", "mo-newsletters__status", "Loading newsletters…");
    status.setAttribute("aria-live", "polite");
    var count = createElement("p", "mo-newsletters__count", "");
    meta.append(status, count);

    var results = createElement("div", "mo-newsletters__results");
    results.id = NAME + "-results-" + instance.id;

    var pagination = createElement("nav", "mo-newsletters__pagination");
    pagination.setAttribute("aria-label", "Newsletter pages");
    pagination.hidden = true;

    var previous = createElement("button", "mo-newsletters__page-button", "Previous");
    previous.type = "button";
    previous.dataset.direction = "previous";
    var pageLabel = createElement("span", "mo-newsletters__page-label", "");
    var next = createElement("button", "mo-newsletters__page-button", "Next");
    next.type = "button";
    next.dataset.direction = "next";
    pagination.append(previous, pageLabel, next);

    element.append(header, meta, results, pagination);

    instance.nodes = {
      input: input,
      status: status,
      count: count,
      results: results,
      pagination: pagination,
      previous: previous,
      pageLabel: pageLabel,
      next: next
    };
  }

  function renderCard(instance, item) {
    var article = createElement("article", "mo-newsletters__card");
    if (item.thumbnailUrl) {
      var media = createElement("div", "mo-newsletters__media");
      var image = createElement("img", "mo-newsletters__thumbnail");
      image.src = item.thumbnailUrl;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", function () {
        media.hidden = true;
      }, { once: true });
      media.append(image);
      article.append(media);
    }

    var body = createElement("div", "mo-newsletters__card-body");
    var date = createElement("time", "mo-newsletters__date", formatDate(item.publishedAt));
    if (item.publishedAt) date.dateTime = new Date(item.publishedAt).toISOString();

    var title = createElement("h3", "mo-newsletters__card-title");
    var link = createElement("a", "mo-newsletters__link", item.title);
    link.href = item.canonicalUrl || "#";
    if (instance.settings.openInNewTab && item.canonicalUrl) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    title.append(link);
    body.append(date, title);

    if (item.summary) {
      body.append(createElement("p", "mo-newsletters__summary", item.summary));
    }

    article.append(body);

    return article;
  }

  function renderResults(instance, focusResults) {
    var state = instance.state;
    var nodes = instance.nodes;
    var pageSize = instance.settings.pageSize;
    var total = state.filteredItems.length;
    var pageCount = Math.max(1, Math.ceil(total / pageSize));
    state.page = Math.min(Math.max(state.page, 1), pageCount);

    var start = (state.page - 1) * pageSize;
    var visibleItems = state.filteredItems.slice(start, start + pageSize);
    var fragment = document.createDocumentFragment();

    visibleItems.forEach(function (item) {
      fragment.append(renderCard(instance, item));
    });

    nodes.results.replaceChildren(fragment);

    if (total === 0) {
      var emptyText = state.query
        ? "No newsletters match your search."
        : "No newsletters are available yet.";
      nodes.results.append(createElement("p", "mo-newsletters__empty", emptyText));
      nodes.status.textContent = emptyText;
      nodes.count.textContent = "";
      nodes.pagination.hidden = true;
      return;
    }

    var shownStart = start + 1;
    var shownEnd = Math.min(start + pageSize, total);
    var resultWord = total === 1 ? "newsletter" : "newsletters";
    nodes.status.textContent = state.query
      ? total + " matching " + resultWord
      : "Archive loaded";
    nodes.count.textContent = "Showing " + shownStart + "–" + shownEnd + " of " + total;
    nodes.pageLabel.textContent = "Page " + state.page + " of " + pageCount;
    nodes.previous.disabled = state.page === 1;
    nodes.next.disabled = state.page === pageCount;
    nodes.pagination.hidden = pageCount <= 1;

    if (focusResults) {
      nodes.results.setAttribute("tabindex", "-1");
      nodes.results.focus({ preventScroll: true });
      var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      nodes.results.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
  }

  function applySearch(instance) {
    var query = instance.nodes.input.value.trim().toLocaleLowerCase();
    instance.state.query = query;
    instance.state.page = 1;
    instance.state.filteredItems = query
      ? instance.state.items.filter(function (item) {
          return item.searchText.includes(query);
        })
      : instance.state.items.slice();
    renderResults(instance, false);
    emit(instance.element, "search", { query: query, count: instance.state.filteredItems.length });
  }

  function changePage(instance, direction) {
    var pageCount = Math.max(
      1,
      Math.ceil(instance.state.filteredItems.length / instance.settings.pageSize)
    );
    var nextPage = instance.state.page + direction;
    if (nextPage < 1 || nextPage > pageCount) return;
    instance.state.page = nextPage;
    renderResults(instance, true);
    emit(instance.element, "pageChange", { page: nextPage, pageCount: pageCount });
  }

  async function loadItems(instance) {
    var settings = instance.settings;
    var url = settings.apiBase + "/collections/" + encodeURIComponent(settings.collectionId) +
      ".json?limit=" + encodeURIComponent(settings.fetchLimit);

    try {
      var response = await fetch(url, {
        signal: instance.controller.signal,
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("Collection request failed with status " + response.status);

      var payload = await response.json();
      var rawItems = Array.isArray(payload && payload.items) ? payload.items : [];
      instance.state.items = rawItems
        .map(normalizeItem)
        .filter(function (item) { return item.canonicalUrl; })
        .sort(function (a, b) { return b.publishedAt - a.publishedAt; });
      instance.state.filteredItems = instance.state.items.slice();
      instance.element.setAttribute("aria-busy", "false");
      renderResults(instance, false);
      emit(instance.element, "load", {
        count: instance.state.items.length,
        fetchLimit: settings.fetchLimit
      });
    } catch (error) {
      if (error && error.name === "AbortError") return;
      instance.element.setAttribute("aria-busy", "false");
      instance.nodes.results.replaceChildren(
        createElement("p", "mo-newsletters__empty mo-newsletters__empty--error", "The newsletter archive could not load. Please try again later.")
      );
      instance.nodes.status.textContent = "Unable to load newsletters";
      instance.nodes.count.textContent = "";
      instance.nodes.pagination.hidden = true;
      emit(instance.element, "error", { error: error });
      console.error("[" + NAME + "]", error);
    }
  }

  function initElement(element) {
    if (instances.has(element)) return instances.get(element);

    var instance = {
      id: String(Math.random()).slice(2),
      element: element,
      originalHTML: element.innerHTML,
      settings: readSettings(element),
      controller: new AbortController(),
      state: { items: [], filteredItems: [], query: "", page: 1 },
      nodes: null,
      listeners: []
    };

    emit(element, "beforeInit");
    renderShell(instance);

    var onInput = function () { applySearch(instance); };
    var onPrevious = function () { changePage(instance, -1); };
    var onNext = function () { changePage(instance, 1); };
    instance.nodes.input.addEventListener("input", onInput);
    instance.nodes.previous.addEventListener("click", onPrevious);
    instance.nodes.next.addEventListener("click", onNext);
    instance.listeners = [
      [instance.nodes.input, "input", onInput],
      [instance.nodes.previous, "click", onPrevious],
      [instance.nodes.next, "click", onNext]
    ];

    instance.destroy = function () {
      instance.controller.abort();
      instance.listeners.forEach(function (listener) {
        listener[0].removeEventListener(listener[1], listener[2]);
      });
      element.classList.remove("mo-newsletters");
      element.removeAttribute("aria-busy");
      element.removeAttribute("aria-labelledby");
      element.removeAttribute("data-wm-initialized");
      element.innerHTML = instance.originalHTML;
      instances.delete(element);
      emit(element, "destroy");
    };

    instances.set(element, instance);
    element.setAttribute("data-wm-initialized", "true");
    loadItems(instance);
    emit(element, "afterInit", { settings: instance.settings });
    return instance;
  }

  function init(root) {
    var scope = root || document;
    var mounts = [];
    if (scope.matches && scope.matches(SELECTOR)) mounts.push(scope);
    if (scope.querySelectorAll) {
      mounts = mounts.concat(Array.prototype.slice.call(scope.querySelectorAll(SELECTOR)));
    }
    return mounts.map(initElement);
  }

  function destroy(root) {
    var scope = root || document;
    var mounts = [];
    if (scope.matches && scope.matches(SELECTOR)) mounts.push(scope);
    if (scope.querySelectorAll) {
      mounts = mounts.concat(Array.prototype.slice.call(scope.querySelectorAll(SELECTOR)));
    }
    mounts.forEach(function (element) {
      var instance = instances.get(element);
      if (instance) instance.destroy();
    });
  }

  window.MONewsSubstackNewsletterCollection = {
    init: init,
    destroy: destroy
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { init(document); }, { once: true });
  } else {
    init(document);
  }
})();
