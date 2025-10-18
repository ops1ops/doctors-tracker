import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';
import TelegramBot from 'node-telegram-bot-api';
import dayjs from 'dayjs';

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

const DOCTOR_IDS = [DOCTOR_ID_BY_SECOND_NAME.Belous];

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

const sendMessage = (message) => bot.sendMessage(TELEGRAM_CHAT_ID, message);

const getDoctorNameById = (doctorId) =>
  Object.entries(DOCTOR_ID_BY_SECOND_NAME).find(([_, id]) => Number(doctorId) === id)?.[0];

const fetchDoctorsSchedule = async (startDate, endDate) => {
  const doctorIdsParam = DOCTOR_IDS.join(',');
  const params = `doctorIds=${doctorIdsParam}&startDate=${startDate}&endDate=${endDate}`;

  console.log(`Fetching doctors: ${params}`);

  const url = `${BASE_URL}?token=${TOKEN}&${params}`;
  const response = await axios.get(url, { httpsAgent: agent });

  return response.data;
};

const printSchedule = async (doctorId, dailySchedules, startDate, endDate) => {
  const doctorName = getDoctorNameById(doctorId);

  const nonEmptyDays = dailySchedules.filter(dayObj => {
    const slots = Object.values(dayObj)[0];

    return slots.length > 0;
  });

  if (nonEmptyDays.length === 0) {
    console.log(`⚠️ No available slots for ${doctorName} (${doctorId})`);
    return;
  }

  const scheduleMessage = `📅 Schedule for ${doctorName} (${doctorId}) (${startDate} - ${endDate}):`;

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

const formatDate = (date) => date.format('DD.MM.YYYY');
const runBatch = async (start, end) => {
  const startDate = formatDate(start);
  const endDate = formatDate(end);

  const doctorsSchedule = await fetchDoctorsSchedule(startDate, endDate);

  doctorsSchedule.forEach((doctorObj) => {
    const [doctorId, dailySchedules] = Object.entries(doctorObj)[0];

    printSchedule(doctorId, dailySchedules, startDate, endDate);
  });

  const receivedDoctorIds = doctorsSchedule.map((item) => Number(Object.keys(item)[0]));

  Object.entries(DOCTOR_ID_BY_SECOND_NAME).forEach(([name, id]) => {
    if (!receivedDoctorIds.includes(id)) {
      console.log(`❌ No data returned for ${name} (${id}) in range ${startDate} - ${endDate}`);
    }
  });
};

const BATCH_DAYS_INTERVAL = 14;

const main = async () => {
  if (!TOKEN) {
    console.error('❌ Missing TOKEN env variable');
    process.exit(1);
  }

  const today = dayjs();
  const firstBatchEnd = today.add(BATCH_DAYS_INTERVAL, 'day');
  const secondBatchStart = firstBatchEnd.add(1, 'day');
  const secondBatchEnd = secondBatchStart.add(BATCH_DAYS_INTERVAL, 'day');

  try {
    await runBatch(today, firstBatchEnd);

    console.log('\n')

    await runBatch(secondBatchStart, secondBatchEnd);
  } catch (error) {
    console.error('❌ Failed to fetch schedules:', error.message);
  }
};

main();

