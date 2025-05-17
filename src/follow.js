// Nexus-FCA: Advanced and Safe Facebook Chat API
// follow.js - Follow or unfollow a user

module.exports = function (defaultFuncs, api, ctx) {
  return function follow(senderID, boolean, callback) {
    let form;
    if (boolean) {
      form = {
        av: ctx.userID,
        fb_api_req_friendly_name: "CometUserFollowMutation",
        fb_api_caller_class: "RelayModern",
        doc_id: "25472099855769847",
        variables: JSON.stringify({
          input: {
            attribution_id_v2:
              "ProfileCometTimelineListViewRoot.react,comet.profile.timeline.list,via_cold_start,1717249218695,723451,250100865708545,,",
            is_tracking_encrypted: true,
            subscribe_location: "PROFILE",
            subscribee_id: senderID,
            tracking: null,
            actor_id: ctx.userID,
            client_mutation_id: "1",
          },
          scale: 1,
        }),
      };
    } else {
      form = {
        av: ctx.userID,
        fb_api_req_friendly_name: "CometUserUnfollowMutation",
        fb_api_caller_class: "RelayModern",
        doc_id: "25472099855769847",
        variables: JSON.stringify({
          action_render_location: "WWW_COMET_FRIEND_MENU",
          input: {
            attribution_id_v2:
              "ProfileCometTimelineListViewRoot.react,comet.profile.timeline.list,tap_search_bar,1717294006136,602597,250100865708545,,",
            is_tracking_encrypted: true,
            subscribe_location: "PROFILE",
            subscribee_id: senderID,
            tracking: null,
            actor_id: ctx.userID,
            client_mutation_id: "1",
          },
          scale: 1,
        }),
      };
    }
    defaultFuncs
      .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
      .then(() => callback && callback(null, true))
      .catch(err => callback && callback(err, false));
  };
};
