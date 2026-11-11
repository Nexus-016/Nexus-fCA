/**
 * ===========================================================
 * Nexus-fCA sticker store API.
 * Nexus-fCA 4.3.0 as api.stickerStore.
 * Adaptation: utils.error/log don't exist in Nexus utils -> npmlog used.
 * (Nexus api.searchStickers stays untouched.)
 * Methods: search, listPacks, getStorePacks, listAllPacks,
 *          addPack, getStickersInPack, getAiStickers
 * ===========================================================
 */
"use strict";

const log = require("npmlog");

function formatPackList(data) {
    const trayPacks = data?.data?.picker_plugins?.sticker_picker?.sticker_store?.tray_packs?.edges;
    const storePacks = data?.data?.viewer?.sticker_store?.available_packs?.edges;

    const packData = storePacks || trayPacks;
    if (!packData || !packData.edges) return { packs: [], page_info: { has_next_page: false } };

    const formattedPacks = packData.edges.map(edge => edge.node ? ({
        id: edge.node.id,
        name: edge.node.name,
        thumbnail: edge.node.thumbnail_image?.uri
    }) : null).filter(Boolean);

    return {
        packs: formattedPacks,
        page_info: packData.page_info,
        store_id: data?.data?.viewer?.sticker_store?.id
    };
}

function formatStickerSearchResults(data) {
    const stickers = data?.data?.sticker_search?.sticker_results?.edges;
    if (!stickers) return [];
    return stickers.map(edge => edge.node ? ({
        type: "sticker",
        ID: edge.node.id,
        url: edge.node.image?.uri,
        animatedUrl: edge.node.animated_image?.uri,
        packID: edge.node.pack?.id,
        label: edge.node.label || edge.node.accessibility_label,
        stickerID: edge.node.id
    }) : null).filter(Boolean);
}

function formatStickerPackResults(data) {
    const stickers = data?.data?.sticker_pack?.stickers?.edges;
    if (!stickers) return [];
    return stickers.map(edge => edge.node ? ({
        type: "sticker",
        ID: edge.node.id,
        url: edge.node.image?.uri,
        animatedUrl: edge.node.animated_image?.uri,
        packID: edge.node.pack?.id,
        label: edge.node.label || edge.node.accessibility_label,
        stickerID: edge.node.id
    }) : null).filter(Boolean);
}

function formatAiStickers(data) {
    const stickers = data?.data?.xfb_trending_generated_ai_stickers?.nodes;
    if (!stickers) return [];
    return stickers.map(node => ({
        type: "sticker",
        ID: node.id,
        url: node.url,
        label: node.label,
        stickerID: node.id
    })).filter(Boolean);
}

module.exports = function(defaultFuncs, api, ctx) {
    const utils = require("../utils");

    async function makeRequest(form) {
        const resData = await defaultFuncs.post("https://www.facebook.com/api/graphql/", ctx.jar, form)
            .then(utils.parseAndCheckLogin(ctx, defaultFuncs));
        if (!resData) throw new Error("GraphQL request returned no data.");
        if (resData.errors) {
            log.error("stickerStore GraphQL Error", resData.errors[0].message);
            throw resData.errors[0];
        }
        return resData;
    }

    return {
        search: async function(query) {
            const form = {
                fb_api_caller_class: 'RelayModern',
                fb_api_req_friendly_name: 'CometStickerPickerSearchResultsRootQuery',
                variables: JSON.stringify({
                    scale: 3,
                    search_query: query,
                    sticker_height: 128,
                    sticker_width: 128,
                    stickerInterface: "MESSAGES"
                }),
                doc_id: '24004987559125954'
            };
            const res = await makeRequest(form);
            return formatStickerSearchResults(res);
        },

        listPacks: async function() {
            const form = {
                fb_api_caller_class: 'RelayModern',
                fb_api_req_friendly_name: 'CometStickerPickerCardQuery',
                variables: JSON.stringify({ scale: 3, stickerInterface: "MESSAGES" }),
                doc_id: '10095807770482952'
            };
            const res = await makeRequest(form);
            return formatPackList(res).packs;
        },

        getStorePacks: async function() {
            log.info("stickerStore", "Fetching all sticker packs from store...");
            let allPacks = [];

            const initialForm = {
                fb_api_caller_class: 'RelayModern',
                fb_api_req_friendly_name: 'CometStickersStoreDialogQuery',
                variables: JSON.stringify({}),
                doc_id: '29237828849196584'
            };
            let res = await makeRequest(initialForm);
            let { packs, page_info, store_id } = formatPackList(res);
            allPacks.push(...packs);

            while (page_info && page_info.has_next_page) {
                const paginatedForm = {
                    fb_api_caller_class: 'RelayModern',
                    fb_api_req_friendly_name: 'CometStickersStorePackListPaginationQuery',
                    variables: JSON.stringify({
                        count: 20,
                        cursor: page_info.end_cursor,
                        id: store_id
                    }),
                    doc_id: '9898634630218439'
                };
                res = await makeRequest(paginatedForm);
                let paginatedResult = formatPackList(res);
                allPacks.push(...paginatedResult.packs);
                page_info = paginatedResult.page_info;
            }

            return allPacks;
        },

        listAllPacks: async function() {
            const [myPacks, storePacks] = await Promise.all([
                this.listPacks(),
                this.getStorePacks()
            ]);
            const allPacksMap = new Map();
            myPacks.forEach(pack => allPacksMap.set(pack.id, pack));
            storePacks.forEach(pack => allPacksMap.set(pack.id, pack));
            return Array.from(allPacksMap.values());
        },

        addPack: async function(packID) {
            const form = {
                fb_api_caller_class: 'RelayModern',
                fb_api_req_friendly_name: 'CometStickersStorePackMutationAddMutation',
                variables: JSON.stringify({
                    input: {
                        pack_id: packID,
                        actor_id: ctx.userID,
                        client_mutation_id: Math.round(Math.random() * 10).toString()
                    }
                }),
                doc_id: '9877489362345320'
            };
            const res = await makeRequest(form);
            return res.data.sticker_pack_add.sticker_pack;
        },

        getStickersInPack: async function(packID) {
            const form = {
                fb_api_caller_class: 'RelayModern',
                fb_api_req_friendly_name: 'CometStickerPickerPackContentRootQuery',
                variables: JSON.stringify({ packID, stickerWidth: 128, stickerHeight: 128, scale: 3 }),
                doc_id: '23982341384707469'
            };
            const res = await makeRequest(form);
            return formatStickerPackResults(res);
        },

        getAiStickers: async function({ limit = 10 } = {}) {
            const form = {
                fb_api_caller_class: 'RelayModern',
                fb_api_req_friendly_name: 'CometStickerPickerStickerGeneratedCardQuery',
                variables: JSON.stringify({ limit }),
                doc_id: '24151467751156443'
            };
            const res = await makeRequest(form);
            return formatAiStickers(res);
        }
    };
};
