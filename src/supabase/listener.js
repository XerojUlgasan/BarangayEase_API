const {
  complaint_actions,
  announcement_actions,
  request_actions,
} = require("./actions");
const { supabase } = require("./client");
require("dotenv").config();

let requestsChannel = null;
let complaintsChannel = null;
let announcementsChannel = null;

const startListeners = () => {
  listenToRequests();
  listenToComplaints();
  listenToAnnouncements();
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
      { event: "INSERT", schema: "public", table: "complaint_tbl" },
      (payload) => {
        console.log("[complaint_tbl][INSERT]", payload);
        complaint_actions(payload);
      },
    )
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

module.exports = {
  startListeners,
  listenToRequests,
  listenToComplaints,
  listenToAnnouncements,
};
