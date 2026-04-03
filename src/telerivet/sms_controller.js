const tr_project = require("./client");

// const from = "639945359587"; // ERNITS
const from = "639945499723"; // XEROJ

const sendMessages = (arr_nums, message) => {
  for (const num in arr_nums) {
    tr_project.sendMessage(
      {
        content: message,
        from_number: from,
        to_number: arr_nums[num],
      },
      (err, message) => {
        if (err) console.log(err);
        // else console.log(message);
      },
    );
  }
};

const sendMessage = (num, content = "Testing testing maramihan") => {
  tr_project.sendMessage(
    {
      content,
      from_number: from,
      to_number: num,
    },
    (err, message) => {
      if (err) console.log(err);
      else console.log(message);
    },
  );
};

module.exports = { sendMessage, sendMessages };
