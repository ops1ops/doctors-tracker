import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

const agent = new https.Agent({ rejectUnauthorized: false });

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TOKEN = process.env.TOKEN;

const BASE_URL = 'https://online.ems.by:444/doctors/schedule';

const DOCTOR_ID_BY_SECOND_NAME = {
  Levashkevich: 640,
  Belous: 532,
};

const DOCTOR_IDS = [DOCTOR_ID_BY_SECOND_NAME.Belous, DOCTOR_ID_BY_SECOND_NAME.Levashkevich];
const START_DATE = '05.10.2025';
const END_DATE = '11.10.2025';

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

const sendMessage = (message) => bot.sendMessage(TELEGRAM_CHAT_ID, message);

const getDoctorNameById = (doctorId) =>
  Object.entries(DOCTOR_ID_BY_SECOND_NAME).find(([_, id]) => Number(doctorId) === id)?.[0];

const fetchDoctorsSchedule = async () => {
  const doctorIdsParam = DOCTOR_IDS.join(',');
  const params = `doctorIds=${doctorIdsParam}&startDate=${START_DATE}&endDate=${END_DATE}`;

  console.log(`Fetching doctors: ${params}`);

  const url = `${BASE_URL}?token=${TOKEN}&${params}`;
  const response = await axios.get(url, { httpsAgent: agent });

  return response.data;
};

const printSchedule = async (doctorId, dailySchedules) => {
  const doctorName = getDoctorNameById(doctorId);

  const nonEmptyDays = dailySchedules.filter(dayObj => {
    const slots = Object.values(dayObj)[0];

    return slots.length > 0;
  });

  if (nonEmptyDays.length === 0) {
    console.log(`⚠️ No available slots for ${doctorName} (${doctorId})`);
    return;
  }

  const scheduleMessage = `📅 Schedule for ${doctorName} (${doctorId}) (${START_DATE} - ${END_DATE}):`;

  console.log(`\n${scheduleMessage}\n`);

  const slotsMessage = nonEmptyDays
    .map((dayObj) => {
      const [date, slots] = Object.entries(dayObj)[0];
      const times = slots.map(({ startAt, endAt }) => `  ${startAt} - ${endAt}`).join('\n');

      return `${date}:\n${times}`;
    })
    .join('\n\n');

  console.log(slotsMessage);

  await sendMessage(`\n${scheduleMessage}\n` + slotsMessage);
};

const main = async () => {
  if (!TOKEN) {
    console.error('❌ Missing TOKEN env variable');
    process.exit(1);
  }

  try {
    const doctorsSchedule = await fetchDoctorsSchedule();

    doctorsSchedule.forEach((doctorObj) => {
      const [doctorId, dailySchedules] = Object.entries(doctorObj)[0];

      printSchedule(doctorId, dailySchedules);
    });

    const receivedDoctorIds = doctorsSchedule.map((item) => Number(Object.keys(item)[0]));

    Object.entries(DOCTOR_ID_BY_SECOND_NAME).forEach(([name, id]) => {
      if (!receivedDoctorIds.includes(id)) {
        console.log(`❌ No data returned for ${name} (${id})`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to fetch schedules:', error.message);
  }
};

main();

