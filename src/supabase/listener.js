const {
  complaint_actions,
  announcement_actions,
  request_actions,
  mediation_actions,
  settlement_actions,
} = require("./actions");
const { supabase } = require("./client");
require("dotenv").config();

let requestsChannel = null;
let complaintsChannel = null;
let announcementsChannel = null;
let mediationsChannel = null;
let settlementsChannel = null;

const startListeners = () => {
  console.log("\nLISTENING FOR SMSSS");
  listenToRequests();
  listenToComplaints();
  listenToAnnouncements();
  listenToMediations();
  listenToSettlements();
};

const listenToRequests = () => {
  if (requestsChannel) return requestsChannel;

  requestsChannel = supabase
    .channel("realtime:public:request_tbl")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "request_tbl" },
      (payload) => {
        console.log("[request_tbl][INSERT]", payload);
        request_actions(payload);
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "request_tbl" },
      (payload) => {
        console.log("[request_tbl][UPDATE]", payload);
        request_actions(payload);
      },
    )
    .subscribe((status) => {
      console.log("\nrequest_tbl listener status:", status);
    });

  return requestsChannel;
};

const listenToComplaints = () => {
  if (complaintsChannel) return complaintsChannel;

  complaintsChannel = supabase
    .channel("realtime:public:complaint_tbl")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "complaint_tbl" },
      (payload) => {
        console.log("[complaint_tbl][UPDATE]", payload);
        complaint_actions(payload);
      },
    )
    .subscribe((status) => {
      console.log("complaint_tbl listener status:", status);
    });

  return complaintsChannel;
};

const listenToAnnouncements = () => {
  if (announcementsChannel) return announcementsChannel;

  announcementsChannel = supabase
    .channel("realtime:public:announcement_tbl")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "announcement_tbl" },
      (payload) => {
        console.log("[announcement_tbl][INSERT]", payload);
        announcement_actions(payload);
      },
    )
    // .on(
    //   "postgres_changes",
    //   { event: "UPDATE", schema: "public", table: "announcement_tbl" },
    //   (payload) => {
    //     console.log("[announcement_tbl][UPDATE]", payload);
    //     announcement_actions(payload);
    //   },
    // )
    .subscribe((status) => {
      console.log("announcement_tbl listener status:", status);
    });

  return announcementsChannel;
};

const listenToMediations = () => {
  if (mediationsChannel) return mediationsChannel;

  mediationsChannel = supabase
    .channel("realtime:public:mediations_tbl")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "mediations_tbl" },
      (payload) => {
        console.log("[mediations_tbl][INSERT]", payload);
        mediation_actions(payload, "INSERT");
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "mediations_tbl" },
      (payload) => {
        console.log("[mediations_tbl][UPDATE]", payload);
        mediation_actions(payload, "UPDATE");
      },
    )
    .subscribe((status) => {
      console.log("mediations_tbl listener status:", status);
    });

  return mediationsChannel;
};

const listenToSettlements = () => {
  if (settlementsChannel) return settlementsChannel;

  settlementsChannel = supabase
    .channel("realtime:public:settlement_tbl")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "settlement_tbl" },
      (payload) => {
        console.log("[settlement_tbl][INSERT]", payload);
        settlement_actions(payload, "INSERT");
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "settlement_tbl" },
      (payload) => {
        console.log("[settlement_tbl][UPDATE]", payload);
        settlement_actions(payload, "UPDATE");
      },
    )
    .subscribe((status) => {
      console.log("settlement_tbl listener status:", status);
    });

  return settlementsChannel;
};

module.exports = {
  startListeners,
  listenToRequests,
  listenToComplaints,
  listenToAnnouncements,
  listenToMediations,
  listenToSettlements,
};
