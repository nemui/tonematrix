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
	OFF: 0x2a,	
	ON: 0xda,
	
	VOLUME: 0.3,
	NOTES: [466.16, 415.30, 369.99, 329.63, 
			293.66, 261.63, 233.08, 207.65,
			185.00, 164.81, 146.83, 130.81,
			116.54, 103.83, 92.50, 	82.41],
	SEMITONES: 2400,
	ENVELOPE: new Float32Array([0.0,0.6,0.0,0.6]), //Attack Decay Sustain Release
		
	canvas: 			null,
	ctx: 				null,			
	state:				null,

	init: function() {				
		KGN.canvas = document.getElementById('game_world');
		KGN.ctx = KGN.canvas.getContext('2d');
				
		KGN.WIDTH = KGN.CELL_NUMBER * KGN.CELL_SIZE + (KGN.CELL_NUMBER-1)*KGN.CELL_GAP;
		KGN.HEIGHT = KGN.WIDTH;
		
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
	
	init: function(){						
		this.cells = new Array(KGN.CELL_NUMBER);		
		for (var i = 0; i < this.cells.length; i++){
			this.cells[i] = new Array(KGN.CELL_NUMBER);
			for (var j = 0; j < this.cells[i].length; j++){	
				this.cells[i][j] = new KGN.Cell(i, j, 0, KGN.NOTES[i]);
			}
		}
	},
	
	update: function(){			
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
				//KGN.ctx.fillStyle = "#FFFFFF";
				//KGN.ctx.fillText(KGN.WaveMap.curr_map[i][j], this.cells[i][j].x, this.cells[i][j].y);
			}
		}
	}
	
}

KGN.Cell = function(i, j, status, frequency){
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
		//KGN.ctx.fillRect(this.x, this.y, KGN.CELL_SIZE, KGN.CELL_SIZE);		
		
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
	reverb: null,
	compressor: null,
	
	init: function(){
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		this.context = new AudioContext();
		this.reverb = this.context.createConvolver();
		var rate = this.context.sampleRate
		, length = rate * 2
		, one_fifth_length = length / 5
		, decay = 20
		, impulse = this.context.createBuffer(2, length, rate)
		, impulseL = impulse.getChannelData(0)
		, impulseR = impulse.getChannelData(1);

		for (var i = 0; i < length; i++) {
			impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
			impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
			if (i > one_fifth_length && decay > 15){
				decay -= 1;
			}
		}
		this.reverb.buffer = impulse;
		this.compressor = this.context.createDynamicsCompressor();
		this.reverb.connect(this.compressor);
		this.compressor.connect(this.context.destination);
		
		this.voices = new Array(KGN.CELL_NUMBER);
		for (var i = 0; i < this.voices.length; i++){
			this.voices[i] = new KGN.Voice(this.context, KGN.NOTES[i]);
		}
		this.ready = true;
	},
	
	play: function(n){
		this.voices[n].play();
	}
	
}

KGN.Voice = function(context, frequency){
	var saw_osc = KGN.Synth.context.createOscillator();
	saw_osc.frequency.value = frequency;
	saw_osc.type = saw_osc.TRIANGLE;
	saw_osc.detune.value = KGN.SEMITONES;
	if (!saw_osc.start){
		saw_osc.start = saw_osc.noteOn;
	}
	
	var sine_osc = KGN.Synth.context.createOscillator();
	sine_osc.frequency.value = frequency;
	sine_osc.type = sine_osc.SINE;
	sine_osc.detune.value = KGN.SEMITONES;
	if (!sine_osc.start){
		sine_osc.start = sine_osc.noteOn;
	}
	
	var gain = KGN.Synth.context.createGainNode();
	gain.gain.value = 0;
	
	saw_osc.connect(gain);
	sine_osc.connect(gain);
	gain.connect(KGN.Synth.reverb);
	saw_osc.start(0);
	sine_osc.start(0);
	
	this.sine_osc = sine_osc;
	this.saw_osc = saw_osc;
	this.gain = gain;
	
	this.play = function(){
		var now = KGN.Synth.context.currentTime;
  		
  		this.gain.gain.cancelScheduledValues(now);
		this.gain.gain.setValueAtTime(this.gain.gain.value, now);
		this.gain.gain.linearRampToValueAtTime(KGN.VOLUME, now + KGN.ENVELOPE[0]);
		this.gain.gain.linearRampToValueAtTime(KGN.ENVELOPE[2], now + KGN.ENVELOPE[0] + KGN.ENVELOPE[1]);
	};
}