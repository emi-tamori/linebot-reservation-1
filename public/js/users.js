(()=>{
    const API_URL = 'https://linebot-reservation2.herokuapp.com/api/';
    const HEADERS = ['ID','名前','登録日','Cut','Shampoo','Color','Spa','次回予約'];
    const CLASSES = ['row-id','row-name','row-resist','row-cut','row-shampoo','row-color','row-spa','row-nextrev'];
    
    // div要素の取得
    const divElement = document.getElementById('usersPage');

    window.addEventListener('load',()=>{
        displaySpinner();
        fetchData();
    });

    const fetchData = async () => {
        try{
            const response = await fetch(API_URL);
            console.log('response:',response);
            if(response.ok){
                const data = await response.json();
                console.log('data:',data);
                divElement.innerHTML = '';
                createTable(data);
            }else{
                alert('HTTPレスポンスエラーです')
            }
        }catch(error){
            console.log('error:',error);
            alert('データ読み込み失敗です');
        }
    }

    //ローディング中スピナー生成
    const displaySpinner = () => {
        const divSpinner = document.createElement('div');
        divSpinner.setAttribute('class','spinner-grow text-primary spinner');
        divSpinner.setAttribute('role','status');
        const spanText = document.createElement('span');
        spanText.setAttribute('class','sr-only');
        spanText.innerHTML = 'Now Loading...';
        divSpinner.appendChild(spanText);
        divElement.appendChild(divSpinner);
    }

    const createTable = (data) => {

        //表題
        const title = document.createElement('p');
        title.setAttribute('class','top-font');
        title.innerHTML = 'お客さま管理ページ';
        divElement.appendChild(title);

        // data.usersを２次元配列の形にする
        const usersData = [];
        data.users.forEach(usersObj=>{

            // 現在時刻のタイムスタンプ取得
            const now = new Date().getTime();

            // data.reservationsからdata.usersのline_uidが一致するもの、かつ現在時刻より先の予約データのみを抽出
            const revData = data.reservations.filter(revObj1=>{
                return usersObj.line_uid === revObj1.line_uid;
            }).filter(revObj2=>{
                return parseInt(revObj2.starttime) > now;
            });

            // revData.starttimeを日時文字列へ変換する
            const nextReservationDate = (revData.length) ? timeConversion(parseInt(revData[0].starttime),1) : '予約なし';

            // usersObj.timestampを日時文字列へ変換する
            const resistrationDate = timeConversion(parseInt(usersObj.timestamp),0);

            // usersData配列へ配列を格納
            usersData.push([
                usersObj.id,
                usersObj.display_name,
                resistrationDate,
                usersObj.cuttime,
                usersObj.shampootime,
                usersObj.colortime,
                usersObj.spatime,
                nextReservationDate
            ]);

            //idの昇順に並び替え
            usersData.sort((a,b)=>{
                if(a[0] < b[0]) return -1;
                if(a[0] > b[0]) return 1;
                return 0;
            });
        });

        // 次回予約日を計算し、usersDataへpushする
        const l = usersData.length+1;  //表題の分＋１している

        // テーブル要素の生成
        const table = document.createElement('table');
        table.setAttribute('id','usersTable');

        for(let i=0;i<l;i++){
            //tr要素の挿入
            const tr = table.insertRow(-1);

            HEADERS.forEach((value,index)=>{
                if(i===0){
                    // 最初の行は表題（th）とする
                    const th = document.createElement('th');
                    th.setAttribute('class',`uTitles`);
                    th.innerHTML = value;
                    tr.appendChild(th);
                }else{
                    // ２行目以降はユーザーデータを格納する要素とする
                    const td = document.createElement('td');
                    td.setAttribute('class',`uElements ${CLASSES[index]}`);
                    td.innerHTML = usersData[i-1][index];

                    // 施術時間をクリックした時の処理
                    if(index >= 3 && index <= 6){
                        td.addEventListener('click',(e)=>{
                            const x = e.pageX;
                            const y = e.pageY;
                            createCard(usersData[i-1],x,y);
                        });
                    }
                    tr.appendChild(td);
                }
            });
        }
        divElement.appendChild(table);
    }

    const createCard = (userDataArray,x,y) => {

        // カード本体の定義
        const divCard = document.createElement('div');
        divCard.setAttribute('class','card text-white bg-primary card-user');
        divCard.style.top = `${y}px`;
        divCard.style.left = `${x/2}px`;

        // カードヘッダーの定義
        const divHeader = document.createElement('div');
        divHeader.setAttribute('class','card-header');
        divHeader.innerHTML = `お客さまID:${userDataArray[0]}`;
        divCard.appendChild(divHeader);

        // カードボディの定義
        const divBody = document.createElement('div');
        divBody.setAttribute('class','card-body');

        // form要素の生成
        const formElement = document.createElement('form');
        formElement.setAttribute('id','userForm');
        formElement.setAttribute('name','userInfo');
        formElement.setAttribute('method','post');

        // 名前入力フォームの生成
        const div_form_name = document.createElement('div');
        div_form_name.setAttribute('class','form-group');

        const label_name = document.createElement('label');
        label_name.setAttribute('class','label_user');
        label_name.innerHTML = '名前';
        div_form_name.appendChild(label_name);

        const input_name = document.createElement('input');
        input_name.setAttribute('type','text');
        input_name.setAttribute('class','form-control name-input');
        input_name.setAttribute('name','name');
        input_name.value = userDataArray[1];
        input_name.disabled = true;
        div_form_name.appendChild(input_name);

        formElement.appendChild(div_form_name);

        // カット時間入力フォームの生成
        const div_form_cut = document.createElement('div');
        div_form_cut.setAttribute('class','form-group inline-block menu-time');

        const label_cut = document.createElement('label');
        label_cut.setAttribute('class','label_user');
        label_cut.innerHTML = 'Cut';
        div_form_cut.appendChild(label_cut);

        const input_cut = document.createElement('input');
        input_cut.setAttribute('type','text');
        input_cut.setAttribute('class','form-control time-input');
        input_cut.setAttribute('name','cuttime');
        input_cut.value = userDataArray[3];
        input_cut.disabled = true;
        div_form_cut.appendChild(input_cut);

        formElement.appendChild(div_form_cut);

        // シャンプー時間の入力フォーム生成
        const div_form_shampoo = document.createElement('div');
        div_form_shampoo.setAttribute('class','form-group inline-block');

        const label_shampoo = document.createElement('label');
        label_shampoo.setAttribute('class','label_user');
        label_shampoo.innerHTML = 'Shampoo';
        div_form_shampoo.appendChild(label_shampoo);

        const input_shampoo = document.createElement('input');
        input_shampoo.setAttribute('type','text');
        input_shampoo.setAttribute('class','form-control time-input');
        input_shampoo.setAttribute('name','shampootime');
        input_shampoo.value = userDataArray[4];
        input_shampoo.disabled = true;
        div_form_shampoo.appendChild(input_shampoo);

        formElement.appendChild(div_form_shampoo);

        // カラーリング時間の入力フォーム生成
        const div_form_color = document.createElement('div');
        div_form_color.setAttribute('class','form-group inline-block menu-time');

        const label_color = document.createElement('label');
        label_color.setAttribute('class','label_user');
        label_color.innerHTML = 'Color';
        div_form_color.appendChild(label_color);

        const input_color = document.createElement('input');
        input_color.setAttribute('type','text');
        input_color.setAttribute('class','form-control time-input');
        input_color.setAttribute('name','colortime');
        input_color.value = userDataArray[5];
        input_color.disabled = true;
        div_form_color.appendChild(input_color);

        formElement.appendChild(div_form_color);

        // ヘッドスパ時間の入力フォーム生成
        const div_form_spa = document.createElement('div');
        div_form_spa.setAttribute('class','form-group inline-block');

        const label_spa = document.createElement('label');
        label_spa.setAttribute('class','label_user');
        label_spa.innerHTML = 'Spa';
        div_form_spa.appendChild(label_spa);

        const input_spa = document.createElement('input');
        input_spa.setAttribute('type','text');
        input_spa.setAttribute('class','form-control time-input');
        input_spa.setAttribute('name','spatime');
        input_spa.value = userDataArray[6];
        input_spa.disabled = true;
        div_form_spa.appendChild(input_spa);

        formElement.appendChild(div_form_spa);

        // 子要素の親要素へのappendChild
        divBody.appendChild(formElement);
        divCard.appendChild(divBody);

        // ボタン要素の作成
        const divButton = document.createElement('div');
        divButton.setAttribute('id','usercard-button-area');

        //編集ボタンの作成
        const editButton = document.createElement('input');
        editButton.setAttribute('class','btn btn-warning card-button');
        editButton.value = '編集';
        editButton.type = 'button';

        //編集ボタンクリック時の動作
        editButton.addEventListener('click',()=>{

            //formのactionを設定　paramとしてidをつける
            formElement.setAttribute('action',`api/users/${userDataArray[0]}`);

            //各インプットの入力をできるようにする
            input_name.disabled = false;
            input_cut.disabled = false;
            input_shampoo.disabled = false;
            input_color.disabled = false;
            input_spa.disabled = false;

            //送信ボタンの生成
            const sendButton = document.createElement('input');
            sendButton.value = '送信';
            sendButton.type = 'button';
            sendButton.setAttribute('class','btn btn-warning card-button');

            //sendButtonクリック時の処理
            sendButton.addEventListener('click',(e)=>{
                e.preventDefault();
                if(!isNaN(document.userInfo.cuttime.value) && !isNaN(document.userInfo.shampootime.value) && !isNaN(document.userInfo.colortime.value) && !isNaN(document.userInfo.spatime.value)){
                    const data = new FormData(formElement);
                    console.log('FormData:',...data.entries());
                    
                    fetch(`/api/users/${userDataArray[0]}`,{
                        method:'POST',
                        body:data,
                        creadentials:'same-origin'
                    })
                    .then(response=>{
                        console.log('response:',response);
                        if(response.ok){
                            response.text()
                                .then(text=>{
                                    alert(`${text}`);
                                    document.location.reload();
                                })
                                .catch(e=>console.log(e));
                        }else{
                            alert('HTTPレスポンスエラーです')
                        }
                    })
                    .catch(e=>{
                        throw e;
                    });
                }else{
                    alert('時間は半角数値を入力してください。');
                }
            });

            divButton.appendChild(sendButton);

            //編集ボタンと削除ボタンを消す
            deleteButton.style.display = 'none';
            editButton.style.display = 'none';
        });

        divButton.appendChild(editButton);

        //削除ボタンの作成
        const deleteButton = document.createElement('input');
        deleteButton.setAttribute('class','btn btn-danger card-button');
        deleteButton.value = '削除';
        deleteButton.type = 'button';

        deleteButton.addEventListener('click',()=>{
            // 処理を書く
        });

        divButton.appendChild(deleteButton);
        divCard.appendChild(divButton);

        //フッターの作成
        const divFooter = document.createElement('div');
        divFooter.setAttribute('class','card-footer text-center');
        divFooter.setAttribute('id','close-form');
        const closeButton = document.createElement('a');
        closeButton.setAttribute('class','closeButton');
        closeButton.textContent = '閉じる';
        divFooter.addEventListener('click',()=>{
            divCard.style.display = 'none';
        });
        divFooter.appendChild(closeButton);

        divCard.appendChild(divFooter);

        // マウスイベント
        divHeader.onmousedown = (e) =>{

            let shiftX = e.clientX - divCard.getBoundingClientRect().left;
            let shiftY = e.clientY - divCard.getBoundingClientRect().top;

            const moveAt = (pageX,pageY) => {
                if(pageX-shiftX>=0){
                    divCard.style.left = pageX - shiftX + 'px';
                }else{
                    divCard.style.left = 0 + 'px';
                }

                if(pageY-shiftY>=0){
                    divCard.style.top = pageY - shiftY + 'px';
                }else{
                    divCard.style.top = 0;
                }
            }

            moveAt(e.pageX,e.pageY);

            const onMouseMove = (e) => {
                moveAt(e.pageX,e.pageY);
            }

            document.addEventListener('mousemove',onMouseMove);

            divHeader.onmouseup = () => {
                document.removeEventListener('mousemove',onMouseMove);
                divHeader.onmouseup = null;
            }

            divHeader.onmouseleave = () => {
                document.removeEventListener('mousemove',onMouseMove);
                divHeader.onmouseleave = null;
            }
        }

        // タッチイベント
        divHeader.ontouchstart = (event) =>{

            const e = event.changedTouches[0];

            let shiftX = e.clientX - divCard.getBoundingClientRect().left;
            let shiftY = e.clientY - divCard.getBoundingClientRect().top;

            const moveAt = (pageX,pageY) => {
                if(pageX-shiftX>=0){
                    divCard.style.left = pageX - shiftX + 'px';
                }else{
                    divCard.style.left = 0 + 'px';
                }

                if(pageY-shiftY>=0){
                    divCard.style.top = pageY - shiftY + 'px';
                }else{
                    divCard.style.top = 0;
                }
            }

            moveAt(e.pageX,e.pageY);

            const onMouseMove = (event) => {
                const e = event.changedTouches[0];
                moveAt(e.pageX,e.pageY);
            }

            document.addEventListener('touchmove',onMouseMove);

            divHeader.ontouchend = () => {
                document.removeEventListener('touchmove',onMouseMove);
                divHeader.ontouchend = null;
            }
        }

        divHeader.ondragstart = () => {
            return false;
        }

        document.body.appendChild(divCard);
    }

    const timeConversion = (timestamp,mode) => {
        console.log('timestamp in conversion',timestamp);
        const date = new Date(timestamp);
        const y = date.getFullYear();
        const m = ("0" + (date.getMonth()+1)).slice(-2);
        const d = ("0" + date.getDate()).slice(-2);
        const h = ("0" + date.getHours()).slice(-2);
        const i = ("0" + date.getMinutes()).slice(-2);

        if(mode === 0){
            return `${y}/${m}/${d}`
        }else{
            return `${y}/${m}/${d} ${h}:${i}`
        }
    }

})();