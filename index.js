(function () {
  const {
    metro: { findByProps, common },
    patcher: { before },
    plugin: { storage },
    ui: {
      components: { Forms },
      toasts: { showToast },
    },
  } = window.vendetta;

  const React = common.React;
  const { ScrollView } = common.ReactNative;
  const { FormSection, FormSwitchRow, FormInput, FormDivider } = Forms;

  const defaults = {
    fixTiktok: true,
    tiktokDomain: "kktiktok.com",
    fixTwitter: true,
    twitterDomain: "fxtwitter.com",
    fixInstagram: true,
    instagramDomain: "oginstagram.com",
    fixReddit: false,
    redditDomain: "rxddit.com",
    stripTracking: true,
  };

  for (const [k, v] of Object.entries(defaults)) {
    if (storage[k] === undefined) storage[k] = v;
  }

  const TRACKING_PARAMS = new Set([
    "si", "igsh", "igshid", "_t", "_r", "utm_source", "utm_medium",
    "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "share_id"
  ]);

  const patches = [];

  function cleanUrlParams(rawUrl) {
    if (!storage.stripTracking) return rawUrl;
    try {
      const u = new URL(rawUrl);
      let changed = false;
      for (const key of [...u.searchParams.keys()]) {
        if (TRACKING_PARAMS.has(key.toLowerCase())) {
          u.searchParams.delete(key);
          changed = true;
        }
      }
      return changed ? u.toString() : rawUrl;
    } catch (_) {
      return rawUrl;
    }
  }

  function rewriteContent(text) {
    if (!text || typeof text !== "string") return text;

    return text.replace(/https?:\/\/[^\s<>()]+/gi, (match) => {
      const urlStr = cleanUrlParams(match);
      try {
        const u = new URL(urlStr);
        const host = u.hostname.replace(/^www\./i, "").toLowerCase();

        if (
          storage.fixTiktok &&
          (host === "tiktok.com" || host === "vm.tiktok.com" || host === "vt.tiktok.com" || host === "m.tiktok.com")
        ) {
          u.hostname = (storage.tiktokDomain || "vxtiktok.com").trim();
          return u.toString();
        }

        if (storage.fixTwitter && (host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com")) {
          u.hostname = (storage.twitterDomain || "fxtwitter.com").trim();
          return u.toString();
        }

        if (storage.fixInstagram && (host === "instagram.com" || host === "m.instagram.com")) {
          u.hostname = (storage.instagramDomain || "vxinstagram.com").trim();
          return u.toString();
        }

        if (storage.fixReddit && (host === "reddit.com" || host === "old.reddit.com" || host === "np.reddit.com")) {
          u.hostname = (storage.redditDomain || "rxddit.com").trim();
          return u.toString();
        }
      } catch (_) {}

      return urlStr;
    });
  }

  function SettingsPage() {
    const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
    const set = (key, val) => {
      storage[key] = val;
      forceUpdate();
    };

    return React.createElement(
      ScrollView,
      { style: { flex: 1 } },
      React.createElement(
        FormSection,
        { title: "Embed Proxies" },
        React.createElement(FormSwitchRow, {
          label: "Fix TikTok Links",
          subLabel: `Rewrites tiktok.com to ${storage.tiktokDomain}`,
          value: storage.fixTiktok,
          onValueChange: (v) => set("fixTiktok", v),
        }),
        storage.fixTiktok &&
          React.createElement(FormInput, {
            title: "TikTok Domain",
            value: storage.tiktokDomain,
            placeholder: "kktiktok.com",
            onChange: (v) => set("tiktokDomain", v),
          }),
        React.createElement(FormDivider),
        React.createElement(FormSwitchRow, {
          label: "Fix Twitter / X Links",
          subLabel: `Rewrites x.com / twitter.com to ${storage.twitterDomain}`,
          value: storage.fixTwitter,
          onValueChange: (v) => set("fixTwitter", v),
        }),
        storage.fixTwitter &&
          React.createElement(FormInput, {
            title: "Twitter / X Domain",
            value: storage.twitterDomain,
            placeholder: "fxtwitter.com",
            onChange: (v) => set("twitterDomain", v),
          }),
        React.createElement(FormDivider),
        React.createElement(FormSwitchRow, {
          label: "Fix Instagram Links",
          subLabel: `Rewrites instagram.com to ${storage.instagramDomain}`,
          value: storage.fixInstagram,
          onValueChange: (v) => set("fixInstagram", v),
        }),
        React.createElement(FormSwitchRow, {
          label: "Fix Reddit Links",
          subLabel: `Rewrites reddit.com to ${storage.redditDomain}`,
          value: storage.fixReddit,
          onValueChange: (v) => set("redditDomain", v),
        }),
        React.createElement(FormSwitchRow, {
          label: "Strip Tracking Parameters",
          subLabel: "Removes ?_t=, ?igsh=, ?si=, utm_*, etc.",
          value: storage.stripTracking,
          onValueChange: (v) => set("stripTracking", v),
        })
      )
    );
  }

  return {
    settings: SettingsPage,

    onLoad() {
      const MessageActions = findByProps("sendMessage", "editMessage");
      if (!MessageActions) {
        showToast("EmbedFixer: Could not find MessageActions");
        return;
      }

      patches.push(
        before("sendMessage", MessageActions, (args) => {
          const [, msg] = args;
          if (msg?.content) {
            msg.content = rewriteContent(msg.content);
          }
        })
      );

      patches.push(
        before("editMessage", MessageActions, (args) => {
          const [, , msg] = args;
          if (msg?.content) {
            msg.content = rewriteContent(msg.content);
          }
        })
      );
    },

    onUnload() {
      for (const unpatch of patches) {
        try {
          unpatch();
        } catch (_) {}
      }
      patches.length = 0;
    },
  };
})();