const moment = require("moment");
require("moment-timezone");

const checkWeekend=async (inputDate,timeZone)=>{

// Get the current date in the CST time zone
const currentDay = moment(`${inputDate}`).format('dddd'); // Adjust timezone as needed

console.log(`Current Day : ${currentDay}`);

// Check if it's a weekend day (Saturday or Sunday)
const isWeekend = currentDay === 'Saturday' || currentDay === 'Sunday';

if (isWeekend) {
  console.log(`Today is a weekend`);
  return true;
} else {
  console.log(`Today is not a weekend`);
  return false;
}

}

exports.checkWeekend=checkWeekend;


