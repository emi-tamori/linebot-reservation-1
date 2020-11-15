const express = require('express');
const app = express();
const line = require('@line/bot-sdk');
const path = require('path');
const { Client } = require('pg');
const router = require('./routers/index');
const apiRouter = require('./routers/api');
const multipart = require('connect-multiparty');

const PORT = process.env.PORT || 5000

const INITIAL_TREAT = [20,10,40,15,30,15,10];  //施術時間初期値
const MENU = ['カット','シャンプー','カラーリング','ヘッドスパ','マッサージ＆スパ','眉整え','顔そり'];
const WEEK = [ "日", "月", "火", "水", "木", "金", "土" ];

const config = {
    channelAccessToken:process.env.ACCESS_TOKEN,
    channelSecret:process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

const connection = new Client({
    user:process.env.PG_USER,
    host:process.env.PG_HOST,
    database:process.env.PG_DATABASE,
    password:process.env.PG_PASSWORD,
    port:5432
  });

connection.connect();

const create_reservationTable = {
  text:'CREATE TABLE IF NOT EXISTS reservations (id SERIAL NOT NULL, line_uid VARCHAR(255), name VARCHAR(100), scheduledate DATE, starttime BIGINT, endtime BIGINT, menu VARCHAR(50));'
};

connection.query(create_reservationTable)
  .then(()=>{
      console.log('table users created successfully!!');
  })
  .catch(e=>console.log(e));

const create_userTable = {
  text:'CREATE TABLE IF NOT EXISTS users (id SERIAL NOT NULL, line_uid VARCHAR(255), display_name VARCHAR(255), timestamp VARCHAR(255), cuttime SMALLINT, shampootime SMALLINT, colortime SMALLINT, spatime SMALLINT);'
};
  
connection.query(create_userTable)
  .then(()=>{
      console.log('table users created successfully!!');
  })
  .catch(e=>console.log(e));

app
    .use(express.static(path.join(__dirname,'public')))
    .use(multipart())
    .use('/',router)
    .use('/api',apiRouter)
    .post('/hook',line.middleware(config),(req,res)=> lineBot(req,res))
    // .use(express.json())
    // .use(express.urlencoded({extended:true}))
    .set('views', path.join(__dirname, 'views'))
    .set('view engine', 'ejs')
    .listen(PORT,()=>console.log(`Listening on ${PORT}`));

const lineBot = (req,res) => {
    res.status(200).end();
    const events = req.body.events;
    const promises = [];

    for(let i=0;i<events.length;i++){
        const ev = events[i];
        console.log("ev:",ev);

        switch(ev.type){
            case 'follow':
                promises.push(greeting_follow(ev));
                break;
            
            case 'message':
                promises.push(handleMessageEvent(ev));
                break;
            
            case 'postback':
                promises.push(handlePostbackEvent(ev));
                break;
        }
    }

    Promise
        .all(promises)
        .then(console.log('all promises passed'))
        .catch(e=>console.error(e.stack));
}

const greeting_follow = async (ev) => {
    const profile = await client.getProfile(ev.source.userId);

    const table_insert = {
        text:'INSERT INTO users (line_uid,display_name,timestamp,cuttime,shampootime,colortime,spatime) VALUES($1,$2,$3,$4,$5,$6,$7);',
        values:[ev.source.userId,profile.displayName,ev.timestamp,INITIAL_TREAT[0],INITIAL_TREAT[1],INITIAL_TREAT[2],INITIAL_TREAT[3]]
      };

    connection.query(table_insert)
    .then(()=>{
        console.log('insert successfully!!')
    })
    .catch(e=>console.log(e));
    
    return client.replyMessage(ev.replyToken,{
        "type":"text",
        "text":`${profile.displayName}さん、フォローありがとうございます\uDBC0\uDC04`
    });
}

const handleMessageEvent = async (ev) => {
    console.log('ev:',ev);
    const profile = await client.getProfile(ev.source.userId);
    const text = (ev.message.type === 'text') ? ev.message.text : '';

    if(text === '予約する'){
      orderChoice(ev,'');
    }else if(text === '予約確認'){
      const nextReservation = await checkNextReservation(ev);
      if(nextReservation.length){
        const startTimestamp = nextReservation[0].starttime;
        const date = dateConversion(startTimestamp);
        const menu = MENU[parseInt(nextReservation[0].menu)];
        return client.replyMessage(ev.replyToken,{
          "type":"text",
          "text":`次回予約は${date}、${menu}でお取りしてます\uDBC0\uDC22`
        });
      }else{
        return client.replyMessage(ev.replyToken,{
          "type":"text",
          "text":"次回の予約は入っておりません。"
        })
      }

    }else if(text === '予約キャンセル'){
      const nextReservation = await checkNextReservation(ev);
      if(nextReservation.length){
        const startTimestamp = parseInt(nextReservation[0].starttime);
        const menu = MENU[parseInt(nextReservation[0].menu)];
        const date = dateConversion(startTimestamp);
        const id = parseInt(nextReservation[0].id);
        return client.replyMessage(ev.replyToken,{
          "type":"flex",
          "altText": "cancel message",
          "contents":
          {
            "type": "bubble",
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": `次回の予約は${date}から、${menu}でおとりしてます。この予約をキャンセルしますか？`,
                  "size": "lg",
                  "wrap": true
                }
              ]
            },
            "footer": {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "予約をキャンセルする",
                    "data": `delete&${id}`
                  }
                }
              ]
            }
          }
        });
      }else{
        return client.replyMessage(ev.replyToken,{
          "type":"text",
          "text":"次回予約は入っておりません。"
        });
      }
    }
    else{
      return client.replyMessage(ev.replyToken,{
        "type":"text",
        "text":`${text}`
      });
  }
}

const handlePostbackEvent = async (ev) => {
    console.log('postback ev:',ev);
    const profile = await client.getProfile(ev.source.userId);
    const data = ev.postback.data;
    const splitData = data.split('&');

    if(splitData[0] === 'menu'){
        const ordered = splitData[1];
        const newOrdered = splitData[2];
        const orderedMenu = ordered ? ordered + '%' + newOrdered : newOrdered;
        orderChoice(ev,orderedMenu);
        // askDate(ev,orderedMenu);
    }

    else if(splitData[0] === 'end'){
      // メニューが何も選ばれていない時の処理
      const orderedMenu = splitData[1];
      askDate(ev,orderedMenu);
    }
    
    else if(splitData[0] === 'date'){
      const orderedMenu = splitData[1];
      const selectedDate = ev.postback.params.date;
      checkReservable(ev,orderedMenu,selectedDate);
      // askTime(ev,orderedMenu,selectedDate);
    }
    
    else if(splitData[0] === 'time'){
        const orderedMenu = splitData[1];
        const selectedDate = splitData[2];
        const selectedTime = splitData[3];
        confirmation(ev,orderedMenu,selectedDate,selectedTime);
    }
    
    else if(splitData[0] === 'yes'){
        const orderedMenu = splitData[1];
        const selectedDate = splitData[2];
        const selectedTime = splitData[3];
        const startTimestamp = timeConversion(selectedDate,selectedTime);
        const treatTime = await calcTreatTime(ev.source.userId,orderedMenu);
        const endTimestamp = startTimestamp + treatTime*60*1000;
        const insertQuery = {
          text:'INSERT INTO reservations (line_uid, name, scheduledate, starttime, endtime, menu) VALUES($1,$2,$3,$4,$5,$6);',
          values:[ev.source.userId,profile.displayName,selectedDate,startTimestamp,endTimestamp,orderedMenu]
        };
        connection.query(insertQuery)
          .then(res=>{
            console.log('データ格納成功！');
            client.replyMessage(ev.replyToken,{
              "type":"text",
              "text":"予約が完了しました。"
            });
          })
          .catch(e=>console.log(e));
    }
    
    else if(splitData[0] === 'no'){
      // あとで何か入れる
    }
    
    else if(splitData[0] === 'delete'){
      const id = parseInt(splitData[1]);
      const deleteQuery = {
        text:'DELETE FROM reservations WHERE id = $1;',
        values:[`${id}`]
      };
      connection.query(deleteQuery)
        .then(res=>{
          console.log('予約キャンセル成功');
          client.replyMessage(ev.replyToken,{
            "type":"text",
            "text":"予約をキャンセルしました。"
          });
        })
        .catch(e=>console.log(e));
    }
}

const timeConversion = (date,time) => {
  const selectedTime = 9 + parseInt(time) - 9;
  return new Date(`${date} ${selectedTime}:00`).getTime();
}

const dateConversion = (timestamp) => {
  const d = new Date(parseInt(timestamp));
  const month = d.getMonth()+1;
  const date = d.getDate();
  const day = d.getDay();
  const hour = ('0' + (d.getHours()+9)).slice(-2);
  const min = ('0' + d.getMinutes()).slice(-2);
  console.log(`${month}月${date}日(${WEEK[day]}) ${hour}:${min}`);
  return `${month}月${date}日(${WEEK[day]}) ${hour}:${min}`;
}


const calcTreatTime = (id,menu) => {
  return new Promise((resolve,reject)=>{
    const selectQuery = {
      text: 'SELECT * FROM users WHERE line_uid = $1;',
      values: [`${id}`]
    };
    connection.query(selectQuery)
      .then(res=>{
        if(res.rows.length){
          const info = res.rows[0];
          const menuArray = menu.split('%');
          const treatArray = [info.cuttime,info.shampootime,info.colortime,info.spatime,INITIAL_TREAT[4],INITIAL_TREAT[5],INITIAL_TREAT[6]];
          let treatTime = 0;
          menuArray.forEach(value=>{
            treatTime += treatArray[parseInt(value)];
          });
          resolve(treatTime);
        }else{
          console.log('LINE　IDに一致するユーザーが見つかりません。');
          return;
        }
      })
      .catch(e=>console.log(e));
  });
}

const orderChoice = (ev,selected) => {
  console.log('selected:',selected);

  let selectedNew = '';

  if(selected.match(/%/)){
    const ordersArray = selected.split('%');
    console.log('ordersArray1:',ordersArray);
    // 重複チェック
    const duplicationRemovedArray = new Set(ordersArray);
    if(duplicationRemovedArray.size === ordersArray.length){
      selectedNew = selected;
    }else{
      //重複メニュー弾き
      ordersArray.pop();
      //selectedNew生成
      ordersArray.forEach((value,index)=>{
        selectedNew += index === 0 ? value : '%' + value;
      });
    }
  }else{
    selectedNew = selected;
  }
  console.log('selectedNew１:',selectedNew);
  const ordersArrayNew = selectedNew.split('%');

  const numericArray = [];
  if(selectedNew){
    //数値型化
    ordersArrayNew.forEach(value=>{
      numericArray.push(parseInt(value));
    });
    //昇順ソート
    numericArray.sort((a,b)=>{
      return (a<b ? -1:1);
    });
    //selectedNew更新
    selectedNew = '';
    numericArray.forEach((value,index)=>{
      selectedNew += index === 0 ? value : '%' + value;
    });
  }

  console.log('selectedNew2:',selectedNew);

  // タイトルと選択メニュー表示
  let title = '';
  let menu = '';
  if(selectedNew){
    title = '他にご希望はありますか？'
    numericArray.forEach((value,index)=>{
      menu += index !== 0 ? ',' + MENU[parseInt(value)] : '選択中：' + MENU[parseInt(value)];
    });
  }else{
    title = 'メニューを選択してください';
    menu = '(複数選択可能です)';
  }

  //ボタン配色
  const colors = [];
  for(let i=0;i<7;i++){
    if(numericArray.some(num=> num === i)){
      colors.push('#00AA00');
    }else{
      colors.push('#999999');
    }
  }

  return client.replyMessage(ev.replyToken,{
      "type":"flex",
      "altText":"menuSelect",
      "contents":
      {
          "type": "bubble",
          "header": {
            "type": "box",
            "layout": "vertical",
            "contents": [
              {
                "type": "text",
                "text": `${title}`,
                "align": "center",
                "size": "lg",
                "wrap":true
              }
            ]
          },
          "hero": {
            "type": "box",
            "layout": "vertical",
            "contents": [
              {
                "type": "text",
                "text": `${menu}`,
                "size": "md",
                "align": "center",
                "wrap":true
              },
              {
                "type": "separator"
              }
            ]
          },
          "body": {
            "type": "box",
            "layout": "vertical",
            "contents": [
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "button",
                    "action": {
                      "type": "postback",
                      "label": "カット",
                      "data": `menu&${selectedNew}&0`
                    },
                    "style": "primary",
                    "color": `${colors[0]}`,
                    "margin": "md"
                  },
                  {
                    "type": "button",
                    "action": {
                      "type": "postback",
                      "label": "シャンプー",
                      "data": `menu&${selectedNew}&1`
                    },
                    "style": "primary",
                    "color": `${colors[1]}`,
                    "margin": "md"
                  }
                ]
              },
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "button",
                    "action": {
                      "type": "postback",
                      "label": "ｶﾗｰﾘﾝｸﾞ",
                      "data": `menu&${selectedNew}&2`
                    },
                    "margin": "md",
                    "style": "primary",
                    "color": `${colors[2]}`
                  },
                  {
                    "type": "button",
                    "action": {
                      "type": "postback",
                      "label": "ヘッドスパ",
                      "data": `menu&${selectedNew}&3`
                    },
                    "margin": "md",
                    "style": "primary",
                    "color": `${colors[3]}`
                  }
                ],
                "margin": "md"
              },
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "button",
                    "action": {
                      "type": "postback",
                      "label": "ﾏｯｻｰｼﾞ&ﾊﾟｯｸ",
                      "data": `menu&${selectedNew}&4`
                    },
                    "margin": "md",
                    "style": "primary",
                    "color": `${colors[4]}`
                  },
                  {
                    "type": "button",
                    "action": {
                      "type": "postback",
                      "label": "顔そり",
                      "data": `menu&${selectedNew}&5`
                    },
                    "style": "primary",
                    "color": `${colors[5]}`,
                    "margin": "md"
                  }
                ],
                "margin": "md"
              },
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "button",
                    "action": {
                      "type": "postback",
                      "label": "眉整え",
                      "data": `menu&${selectedNew}&6`
                    },
                    "margin": "md",
                    "style": "primary",
                    "color": `${colors[6]}`
                  },
                  {
                    "type": "button",
                    "action": {
                      "type": "postback",
                      "label": "選択終了",
                      "data": `end&${selectedNew}`
                    },
                    "margin": "md",
                    "style": "primary",
                    "color": "#0000ff"
                  }
                ],
                "margin": "md"
              },
              {
                "type": "separator"
              }
            ]
          }
        }
  });
}

const askDate = (ev,orderedMenu) => {
    return client.replyMessage(ev.replyToken,{
        "type":"flex",
        "altText":"予約日選択",
        "contents":
        {
            "type": "bubble",
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": "来店希望日を選んでください。",
                  "size": "md",
                  "align": "center"
                }
              ]
            },
            "footer": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "button",
                  "action": {
                    "type": "datetimepicker",
                    "label": "希望日を選択する",
                    "data": `date&${orderedMenu}`,
                    "mode": "date"
                  }
                }
              ]
            }
          }
    });
}

const askTime = (ev,orderedMenu,selectedDate) => {
    return client.replyMessage(ev.replyToken,{
        "type":"flex",
        "altText":"予約日選択",
        "contents":
        {
            "type": "bubble",
            "header": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": "ご希望の時間帯を選択してください（緑=予約可能です）",
                  "wrap": true,
                  "size": "lg"
                },
                {
                  "type": "separator"
                }
              ]
            },
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "box",
                  "layout": "horizontal",
                  "contents": [
                    {
                      "type": "button",
                      "action": {
                        "type": "postback",
                        "label": "9時-",
                        "data":`time&${orderedMenu}&${selectedDate}&0`
                      },
                      "style": "primary",
                      "color": "#00AA00",
                      "margin": "md"
                    },
                    {
                      "type": "button",
                      "action": {
                        "type": "postback",
                        "label": "10時-",
                        "data": `time&${orderedMenu}&${selectedDate}&1`
                      },
                      "style": "primary",
                      "color": "#00AA00",
                      "margin": "md"
                    },
                    {
                      "type": "button",
                      "action": {
                        "type": "postback",
                        "label": "11時-",
                        "data": `time&${orderedMenu}&${selectedDate}&2`
                      },
                      "style": "primary",
                      "color": "#00AA00",
                      "margin": "md"
                    }
                  ]
                },
                {
                  "type": "box",
                  "layout": "horizontal",
                  "contents": [
                    {
                      "type": "button",
                      "action": {
                        "type": "postback",
                        "label": "12時-",
                        "data": `time&${orderedMenu}&${selectedDate}&3`
                      },
                      "style": "primary",
                      "color": "#00AA00",
                      "margin": "md"
                    },
                    {
                      "type": "button",
                      "action": {
                        "type": "postback",
                        "label": "13時-",
                        "data": `time&${orderedMenu}&${selectedDate}&4`
                      },
                      "style": "primary",
                      "color": "#00AA00",
                      "margin": "md"
                    },
                    {
                      "type": "button",
                      "action": {
                        "type": "postback",
                        "label": "14時-",
                        "data": `time&${orderedMenu}&${selectedDate}&5`
                      },
                      "style": "primary",
                      "color": "#00AA00",
                      "margin": "md"
                    }
                  ],
                  "margin": "md"
                },
                {
                  "type": "box",
                  "layout": "horizontal",
                  "contents": [
                    {
                      "type": "button",
                      "action": {
                        "type": "postback",
                        "label": "15時-",
                        "data": `time&${orderedMenu}&${selectedDate}&6`
                      },
                      "style": "primary",
                      "color": "#00AA00",
                      "margin": "md"
                    },
                    {
                      "type": "button",
                      "action": {
                        "type": "postback",
                        "label": "16時-",
                        "data": `time&${orderedMenu}&${selectedDate}&7`
                      },
                      "style": "primary",
                      "color": "#00AA00",
                      "margin": "md"
                    },
                    {
                      "type": "button",
                      "action": {
                        "type": "postback",
                        "label": "17時-",
                        "data": `time&${orderedMenu}&${selectedDate}&8`
                      },
                      "style": "primary",
                      "color": "#00AA00",
                      "margin": "md"
                    }
                  ],
                  "margin": "md"
                },
                {
                  "type": "box",
                  "layout": "horizontal",
                  "contents": [
                    {
                      "type": "button",
                      "action": {
                        "type": "postback",
                        "label": "18時-",
                        "data": `time&${orderedMenu}&${selectedDate}&9`
                      },
                      "style": "primary",
                      "color": "#00AA00",
                      "margin": "md"
                    },
                    {
                      "type": "button",
                      "action": {
                        "type": "postback",
                        "label": "19時-",
                        "data": `time&${orderedMenu}&${selectedDate}&10`
                      },
                      "style": "primary",
                      "color": "#00AA00",
                      "margin": "md"
                    },
                    {
                      "type": "button",
                      "action": {
                        "type": "postback",
                        "label": "終了",
                        "data": "end"
                      },
                      "style": "primary",
                      "color": "#0000ff",
                      "margin": "md"
                    }
                  ],
                  "margin": "md"
                }
              ]
            }
          }       
    });
}

const confirmation = (ev,menu,date,time) => {
  const splitDate = date.split('-');
  const selectedTime = 9 + parseInt(time);
  return client.replyMessage(ev.replyToken,{
    "type":"flex",
    "altText":"menuSelect",
    "contents":
    {
      "type": "bubble",
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": `次回予約は${splitDate[1]}月${splitDate[2]}日 ${selectedTime}時〜でよろしいですか？`,
            "size": "lg",
            "wrap": true
          }
        ]
      },
      "footer": {
        "type": "box",
        "layout": "horizontal",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "はい",
              "data": `yes&${menu}&${date}&${time}`
            }
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "いいえ",
              "data": `no&${menu}&${date}&${time}`
            }
          }
        ]
      }
    }
  });
}

const checkNextReservation = (ev) => {
  return new Promise((resolve,reject)=>{
    const id = ev.source.userId;
    const nowTime = new Date().getTime();
    console.log('nowTime:',nowTime);

    const selectQuery = {
      text:'SELECT * FROM reservations;'
    };
    connection.query(selectQuery)
      .then(res=>{
        console.log('res.rows:',res.rows);
        if(res.rows.length){
          const nextReservation = res.rows.filter(object1=>{
            return object1.line_uid === id;
          })
          .filter(object2=>{
            return parseInt(object2.starttime) >= nowTime;
          });
          console.log('nextReservation:',nextReservation);
          resolve(nextReservation);
        }else{
          resolve([]);
        }
      })
      .catch(e=>console.log(e));
  });
}

const checkReservable = (ev,menu,date) => {
  return new Promise( async (resolve,reject)=>{
    const id = ev.source.userId;
    const treatTime = await calcTreatTime(id,menu);
    console.log('treatTime:',treatTime);

    const select_query = {
      text:'SELECT * FROM schedules WHERE scheduledate = $1 ORDER BY starttime ASC;',
      values:[`${date}`]
    };

    connection.query(select_query)
      .then(res=>{
        console.log('res.rows:',res.rows);
      })
      .catch(e=>console.log(e));
  })
}