(()=>{
  const API_URL = 'https://linebot-reservation2.herokuapp.com/api/';
  const WEEKS = ["日", "月", "火", "水", "木", "金", "土"];
  const ONEDAY = 24*60*60*1000;
  const OPENTIME = 12;
  const CLOSETIME = 23;

  window.addEventListener('load',()=>{
    fetchData();
  });

  const fetchData = async () => {
    try{
      const response = await fetch(API_URL);
      if(response.ok){
        const data = await response.json();
        console.log('data:',data);
        createReservationTable(data);
      }else{
        alert('HTTPレスポンスエラーです');
      }
    }catch(error){
      console.log('error:',error);
      alert('データ読み込み失敗です');
    }
  }

  const createReservationTable = (data) => {
    const divElement = document.getElementById('reservationsPage');

    let index = 0;

    const reservationsData = data.reservations;
    
    //現在のタイムスタンプを取得
    const nowTime = new Date().getTime();
    console.log('nowtime:',nowTime);

    //年月日生成
    const year = new Date(nowTime).getFullYear();
    const month = new Date(nowTime).getMonth()+1;

    //日送りボタン
    const backButton = document.createElement('button');
    const forwardButton = document.createElement('button');
    backButton.addEventListener('click',()=>{
      index--;
      console.log('index=',index);
    });
    forwardButton.addEventListener('click',()=>{
      index++;
      console.log('index=',index);
    });
    divElement.appendChild(backButton);
    divElement.appendChild(forwardButton);

    //日時ラベル
    const p = document.createElement('p');
    p.innerHTML = `${year}年${month}月`;
    divElement.appendChild(p);
    
    //テーブルエレメント生成
    const table = document.createElement('table');
    table.setAttribute('id','reservationTable');

    //テーブルヘッダ生成
    const tableHeader = document.createElement('thead');
    const trDate = document.createElement('tr');
    const trWeek = document.createElement('tr');

    for(let i=0;i<8;i++){
      const thDate = document.createElement('th');
      thDate.setAttribute('class','table-header');
      const thWeek = document.createElement('th');
      thWeek.setAttribute('class','table-header');
      if(i === 0){
        thDate.innerHTML = 'Date';
        thWeek.innerHTML = 'Week';
        trDate.appendChild(thDate);
        trWeek.appendChild(thWeek);
      }else{
        const date = new Date(nowTime+(i-1)*ONEDAY).getDate();
        const week = WEEKS[new Date(nowTime+(i-1)*ONEDAY).getDay()];
        thDate.innerHTML = date;
        thWeek.innerHTML = week;
        trDate.appendChild(thDate);
        trWeek.appendChild(thWeek);
      }
    }
    tableHeader.appendChild(trDate);
    tableHeader.appendChild(trWeek);
    table.appendChild(tableHeader);
    
    //テーブル要素生成
    const tableBody = document.createElement('tbody');
    for(let i=0;i<CLOSETIME-OPENTIME;i++){
      const trElement = document.createElement('tr');
      for(let j=0;j<8;j++){
        if(j === 0){
          const td = document.createElement('td');
          td.setAttribute('class','table-header');
          td.innerHTML = `${OPENTIME+i}:00`;
          trElement.appendChild(td);
        }else{
          const td = document.createElement('td');
          td.setAttribute('class','table-element');
          td.innerHTML = 'test';
          trElement.appendChild(td);
        }
      }
      tableBody.appendChild(trElement);
    }
    table.appendChild(tableBody);
    divElement.appendChild(table);
  }

})();