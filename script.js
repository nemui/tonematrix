// http://paulirish.com/2011/requestanimationframe-for-smart-animating
// shim layer with setTimeout fallback
window.requestAnimFrame = (function(){
	return  window.requestAnimationFrame     || 
		  window.webkitRequestAnimationFrame || 
		  window.mozRequestAnimationFrame    || 
		  window.oRequestAnimationFrame      || 
		  window.msRequestAnimationFrame     || 
		  function( callback ){
				window.setTimeout(callback, 1000 / 60);
		  };
})();

var KGN = {
	WIDTH: 	0,
	HEIGHT: 0,	

	CELL_SIZE: 24,
	CELL_RADIUS: 2,
	CELL_GAP: 8,
	CELL_NUMBER: 16,
	INTERVAL: 128,
	WAVE_INTERVAL: 25,
	WAVE_FORCE: 80,
	WAVE_DAMP: 0.1,
	
	BLACK: 	"#000000",	
	SAVE_BTN_IDLE: "#dadada",
	SAVE_BTN_PRESSED: "#24E33B",
	OFF: 0x2a,	
	ON: 0xda,
	
	VOLUME: 0.5,
	START_NOTE: 369.99,
	NOTE_RATIOS: [1, 9/8, 5/4, 3/2, 5/3, 2],
	ENVELOPE: new Float32Array([0,0.1,0,0]), //Attack Decay Sustain Release
		
	canvas: 			null,
	ctx: 				null,			
	state:				null,

	init: function() {				
		KGN.canvas = document.getElementById('game_world');
		KGN.ctx = KGN.canvas.getContext('2d');
		
		
				
		KGN.WIDTH = KGN.CELL_NUMBER * KGN.CELL_SIZE + (KGN.CELL_NUMBER-1)*KGN.CELL_GAP;
		KGN.HEIGHT = KGN.WIDTH + KGN.CELL_SIZE + KGN.CELL_GAP;
		
		
		KGN.canvas.width = KGN.WIDTH;
		KGN.canvas.height = KGN.HEIGHT;		
		
		var iOS = ( navigator.userAgent.match(/(iPad|iPhone|iPod)/g) ? true : false );
		
		KGN.WaveMap.init();
		if (!iOS){
			KGN.Input.init();	
			KGN.Synth.init();
		}
		else {
			KGN.Start.init();
		}
		KGN.InGame.init();
		KGN.state = (iOS) ? KGN.Start : KGN.InGame;				        
		
		KGN.loop();		
	},		
	
	update: function() {
		KGN.state.update();
	},
	
	render: function() {
		KGN.ctx.fillStyle = KGN.BLACK;
		KGN.ctx.fillRect(0, 0, KGN.WIDTH, KGN.HEIGHT);		
		KGN.state.render();
	},
	
	loop: function() {
		requestAnimFrame( KGN.loop );

       KGN.update();
       KGN.render();
	},
	
	random: function(n){
		return ~~(Math.random()*n);
	}
};

KGN.Start = {

	init: function(){
		window.addEventListener("mousedown", this.touchstart_callback, false);
		window.addEventListener("touchstart", this.touchstart_callback, false);
	},
	
	touchstart_callback: function(e){
		e.preventDefault();    		
		KGN.Synth.init();
		window.removeEventListener("mousedown", KGN.Start.touchstart_callback, false);
		window.removeEventListener("touchstart", KGN.Start.touchstart_callback, false);
	},
	
	update: function(){
		if (KGN.Synth.ready){
			KGN.Input.init();
			KGN.state = KGN.InGame;
		}
	},
	
	render: function(){
		KGN.InGame.render();
	}
};

KGN.Input = {
	x: 0,
	y: 0,
	UNSET: -1,
	SET: 2,
	ON: 1,
	OFF: 0,
	state: -1,
	moved: false,
	
	init: function(){
		window.addEventListener('mousedown', function(e) {
			e.preventDefault();			
			KGN.Input.set(e);
		}, false);

		window.addEventListener('mousemove', function(e) {
			e.preventDefault();			
			KGN.Input.modify(e);
		}, false);

		window.addEventListener('mouseup', function(e) {
			e.preventDefault();			
			KGN.Input.unset(e);
		}, false);

		window.addEventListener('touchstart', function(e) {
			e.preventDefault();    		
			KGN.Input.set(e.touches[0]);			
		}, false);

		window.addEventListener('touchmove', function(e) {       
			e.preventDefault();
			KGN.Input.modify(e);
		}, false);

		window.addEventListener('touchend', function(e) {            
			e.preventDefault();
			KGN.Input.unset(e);
		}, false);
	},

	set: function(event) {
		event.button = event.button || 0;
		if (event.button == 0){
			this.x = event.pageX - KGN.canvas.offsetLeft;
			this.y = event.pageY - KGN.canvas.offsetTop;
			this.state = KGN.Input.SET;
			this.moved = false;
		}
	},
	
	unset: function(event) {
		event.button = event.button || 0;
		if (event.button == 0){
			this.state = KGN.Input.UNSET;
		}
	},
	
	modify: function(event) {
		this.x = event.pageX - KGN.canvas.offsetLeft;
       	this.y = event.pageY - KGN.canvas.offsetTop;  
       	this.moved = true;     
	},
   
   in_rect_area: function(x, y, width, height){
		var result = false;	
		
		if (this.x >= x && this.x <= x + width && this.y >= y && this.y <= y + height){
			result = true;
		}
		return result;
	}
};

KGN.InGame = {	
	cells: null,	
	column: 0,
	prev_column: 0,	
	previous_ms: new Date().getTime(),	
	save_btn: null,
	clear_btn: null,
	
	init: function(){
		this.cells = new Array(KGN.CELL_NUMBER);
		var codes = location.search.substr(1).split('.');
		
		for (var i = 0; i < this.cells.length; i++){
			this.cells[i] = new Array(KGN.CELL_NUMBER);
			var code = decodeURIComponent(codes[i]||0);
			for (var j = 0; j < this.cells[i].length; j++){	
				var mask = 1<<j;
				this.cells[i][j] = new KGN.Cell(i, j, (code&mask)>>j);
			}
		}
		
		this.clear_btn = new KGN.Button(
			(this.cells.length/2-3) * (KGN.CELL_SIZE+KGN.CELL_GAP) - 1, 
			(this.cells.length) * (KGN.CELL_SIZE+KGN.CELL_GAP) - 1, 
			KGN.CELL_SIZE*2+KGN.CELL_GAP,
			KGN.CELL_SIZE,
			'clear'
		);
		
		this.save_btn = new KGN.Button(
			(this.cells.length/2+1) * (KGN.CELL_SIZE+KGN.CELL_GAP) - 1, 
			(this.cells.length) * (KGN.CELL_SIZE+KGN.CELL_GAP) - 1, 
			KGN.CELL_SIZE*2+KGN.CELL_GAP,
			KGN.CELL_SIZE,
			'url'
		);
		
	},
	
	update: function(){		
		if (this.save_btn.update()){
			this.make_url();
		}
		if (this.clear_btn.update()){
			this.clear_map();
		}	
		if (KGN.Input.state != KGN.Input.UNSET){	
			var broke = false;
			for (var i = 0; i < this.cells.length; i++){
				for (var j = 0; j < this.cells[0].length; j++){
					var c = this.cells[i][j];
					if (KGN.Input.in_rect_area(c.x, c.y, KGN.CELL_SIZE, KGN.CELL_SIZE)){
						if (KGN.Input.state == KGN.Input.SET){
							c.status = 1 - c.status;
							KGN.Input.state = c.status;	
							KGN.WaveMap.drop(i, j);							
						}
						else {
							if (c.status != KGN.Input.state){
								c.status = KGN.Input.state;
								KGN.WaveMap.drop(i, j);
							}
						}
						
						broke = true;
						break;
					}
				}
				if (broke) break;
			}
		}
		
		var this_ms = new Date().getTime();
		
		if (this_ms - this.previous_ms >= KGN.INTERVAL){
			this.previous_ms = this_ms;
			this.column = (this.column + 1) % KGN.CELL_NUMBER;
			for (var i = 0; i < this.cells.length; i++){
				this.cells[i][this.prev_column].playing = false;
				if (this.cells[i][this.column].status){
					this.cells[i][this.column].playing = true;
					KGN.Synth.play(i);
					KGN.WaveMap.drop(i, this.column);
				}
			}
			this.prev_column = this.column;
		}
		
		KGN.WaveMap.update();		
	},
	
	render: function(){		
		for (var i = 0; i < this.cells.length; i++){
			for (var j = 0; j < this.cells[i].length; j++){
				this.cells[i][j].render();
			}
		}
		this.save_btn.render();
		this.clear_btn.render();
	},
	
	make_url: function(){
		var codes = "?";
		for (var i = 0; i < this.cells.length; i++){
			var code = 0;
			for (var j = 0; j < this.cells[i].length; j++){
				code |= this.cells[i][j].status << j;
			}
			codes += code + ".";
		}
		window.history.replaceState('foobar', 'Tonematrix clone', 'index.html'+codes);
	},
	
	clear_map: function(){
		for (var i = 0; i < this.cells.length; i++){
			for (var j = 0; j < this.cells[i].length; j++){
				this.cells[i][j].pause();
				this.cells[i][j].status = 0;
			}
		}
		window.history.replaceState('foobar', 'Tonematrix clone', 'index.html');
	}
}

KGN.Button = function(x, y, width, height, label){
	this.x = x;
	this.y = y;
	this.width = width;
	this.height = height;
	this.label = label;
	KGN.ctx.font = "12px sans-serif";
	this.label_x = x + (width - KGN.ctx.measureText(label).width)/2;
	this.label_y = y + height/2;
	this.pressed = false;
	
	this.render = function(){
		if (this.pressed){
			KGN.ctx.strokeStyle = KGN.SAVE_BTN_PRESSED;
			KGN.ctx.fillStyle = KGN.SAVE_BTN_PRESSED;
		}
		else{
			KGN.ctx.strokeStyle = KGN.SAVE_BTN_IDLE;
			KGN.ctx.fillStyle = KGN.SAVE_BTN_IDLE;
		}
		KGN.ctx.strokeRect(this.x, this.y, this.width, this.height);
		KGN.ctx.font="12px sans-serif";
		KGN.ctx.textBaseline="middle";
		KGN.ctx.fillText(this.label, this.label_x, this.label_y);
	}
	
	this.update = function(){
		var result = false;
		if (KGN.Input.state == KGN.Input.SET && KGN.Input.moved == false && KGN.Input.in_rect_area(this.x, this.y, this.width, this.height)){
			if (!this.pressed){
				this.pressed = true;
				result = true;
			}
		}	
		else{
			this.pressed = false;
		}	
		return result;
	}
	
}

KGN.Cell = function(i, j, status){
	this.i = i;
	this.j = j;
	this.x = j * (KGN.CELL_SIZE+KGN.CELL_GAP);
	this.y = i * (KGN.CELL_SIZE+KGN.CELL_GAP);			
	this.status = status;
	this.next_status = status;
	this.color = KGN.ON;
	this.palying = false;
	
	this.render = function(){
		if (this.playing){
			this.color = "#ffffff";
		}
		else{		
			this.color = ~~(((this.status) ? KGN.ON : KGN.OFF) + 0xff*(KGN.WaveMap.curr_map[this.i][this.j] / KGN.WAVE_FORCE));
			this.color = (this.color > 220) ? 220 : this.color
			var temp = this.color.toString(16);
			this.color = "#" + temp + "" + temp + "" + temp;
		}
		KGN.ctx.fillStyle = this.color;						
		
		KGN.ctx.beginPath();
		KGN.ctx.moveTo(this.x, this.y + KGN.CELL_RADIUS);
		KGN.ctx.lineTo(this.x, this.y + KGN.CELL_SIZE - KGN.CELL_RADIUS);
		KGN.ctx.quadraticCurveTo(this.x, this.y + KGN.CELL_SIZE, this.x + KGN.CELL_RADIUS, this.y + KGN.CELL_SIZE);
		KGN.ctx.lineTo(this.x + KGN.CELL_SIZE - KGN.CELL_RADIUS, this.y + KGN.CELL_SIZE);
		KGN.ctx.quadraticCurveTo(this.x + KGN.CELL_SIZE, this.y + KGN.CELL_SIZE, this.x + KGN.CELL_SIZE, this.y + KGN.CELL_SIZE - KGN.CELL_RADIUS);
		KGN.ctx.lineTo(this.x + KGN.CELL_SIZE, this.y + KGN.CELL_RADIUS);
		KGN.ctx.quadraticCurveTo(this.x + KGN.CELL_SIZE, this.y, this.x + KGN.CELL_SIZE - KGN.CELL_RADIUS, this.y);
		KGN.ctx.lineTo(this.x + KGN.CELL_RADIUS, this.y);
		KGN.ctx.quadraticCurveTo(this.x, this.y, this.x, this.y + KGN.CELL_RADIUS);
		KGN.ctx.fill();		
		
	};
	
	this.play = function(){
		this.playing = true;
	};
	
	this.pause = function(){
		this.playing = false;	
	};
}

KGN.WaveMap = {
	next_map: null,
	curr_map: null,	
	buffer: null,
	previous_ms: new Date().getTime(),		
	neighbours: [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-2, 0], [0, -2], [2, 0], [0, 2]],
	
	init: function(){
		this.next_map = new Array(KGN.CELL_NUMBER);	
		
		for (var i = 0; i < KGN.CELL_NUMBER; i++){
			this.next_map[i] = new Array(KGN.CELL_NUMBER);
			for (var j = 0; j < KGN.CELL_NUMBER; j++){
				this.next_map[i][j] = 0;
			}			
		}
		this.curr_map = this.copy(this.next_map);
		this.buffer = this.copy(this.next_map);
	},
	
	drop: function(i, j){
		this.curr_map[i][j] = KGN.WAVE_FORCE;		
	},
	
	update: function(){
		var this_ms = new Date().getTime();
		if (this_ms - this.previous_ms >= KGN.WAVE_INTERVAL){
			this.previous_ms = this_ms;
			for (var i = 0; i < this.curr_map.length; i++){
				for (var j = 0; j < this.curr_map.length; j++){								
					var neighbours_number = 0;
					var neighbours_sum = 0;
					for (var k = 0; k < this.neighbours.length; k++){
						var ni = i + this.neighbours[k][0];
						var nj = j + this.neighbours[k][1];
						if (ni >= 0 && ni < KGN.CELL_NUMBER && nj >= 0 && nj < KGN.CELL_NUMBER){
							neighbours_number++;
							neighbours_sum += this.curr_map[ni][nj];
						}
					}
					var new_value = ~~(neighbours_sum/~~(neighbours_number/2)) - this.next_map[i][j];
					new_value -= new_value*KGN.WAVE_DAMP;
					this.buffer[i][j] = (new_value < 0.1) ? 0 : new_value;					
				}
			}
			this.next_map = this.copy(this.curr_map);
			this.curr_map = this.copy(this.buffer);
		}		
				
	},
	
	copy: function(original){
		var copy = new Array(original.length);
		for (var i = 0; i < copy.length; i++){
			copy[i] = original[i].slice(0);
		}
		return copy;
	}
	
}

KGN.Synth = {
	ready: false,
	context: null, 
	voices: null,
	filter: null,
	reverb: null,
	compressor: null,
	
	init: function(){
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		this.context = new AudioContext();
		this.reverb = this.context.createConvolver();
		var rate = this.context.sampleRate
		, length = rate * 2
		, decay = 15
		, impulse = this.context.createBuffer(2, length, rate)
		, impulseL = impulse.getChannelData(0)
		, impulseR = impulse.getChannelData(1);

		for (var i = 0; i < length; i++) {
			impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
			impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
			if (i > length/3){
				decay = 8;
			}
		}
		this.reverb.buffer = impulse;
		
		this.compressor = this.context.createDynamicsCompressor();
		
		this.filter = this.context.createBiquadFilter();
		this.filter.type = this.filter.LOWPASS;
		this.filter.frequency.value = KGN.START_NOTE*3;
		
		this.filter.connect(this.reverb);
		this.reverb.connect(this.compressor);
		this.compressor.connect(this.context.destination);
		
		this.voices = new Array(KGN.CELL_NUMBER);
		var base_freq = KGN.START_NOTE;
		var ratio_index = 0;
		for (var i = this.voices.length-1; i >=0; i--){
			this.voices[i] = new KGN.Voice(this.context, base_freq*KGN.NOTE_RATIOS[ratio_index++]);
			if (ratio_index == 5){
				base_freq = base_freq*KGN.NOTE_RATIOS[ratio_index];
				ratio_index = 0;
			}
		}
		this.ready = true;
	},
	
	play: function(n){
		this.voices[n].play();
	}
	
}

KGN.Voice = function(context, frequency){
	
	var sine_osc = KGN.Synth.context.createOscillator();
	sine_osc.frequency.value = frequency;
	sine_osc.type = sine_osc.SINE;
	if (!sine_osc.start){
		sine_osc.start = sine_osc.noteOn;
	}
	
	var gain = KGN.Synth.context.createGainNode();
	gain.gain.value = 0;
	
	sine_osc.connect(gain);
	gain.connect(KGN.Synth.filter);
	sine_osc.start(0);
	
	this.sine_osc = sine_osc;
	this.gain = gain;
	
	this.play = function(){
		var now = KGN.Synth.context.currentTime;
  		
  		this.gain.gain.cancelScheduledValues(now);
		this.gain.gain.setValueAtTime(this.gain.gain.value, now);
		this.gain.gain.linearRampToValueAtTime(KGN.VOLUME, now + KGN.ENVELOPE[0]);
		this.gain.gain.linearRampToValueAtTime(KGN.ENVELOPE[2], now + KGN.ENVELOPE[0] + KGN.ENVELOPE[1]);
	};
}