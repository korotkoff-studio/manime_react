// app/utils/initWebGPU.ts
import {
    Anime4KPipeline,
    Original,
    Anime4KPipelineDescriptor,
    ModeA,
    ModeB,
    ModeC,
    ModeAA,
    ModeBB,
    ModeCA,
    CNNx2M,
    CNNx2VL,
    CNNM,
    CNNVL,
    Anime4KPresetPipelineDescriptor,
} from 'anime4k-webgpu';

type Settings = {
    requestFrame: string;
    effect: string;
    deblurCoef: number;
    denoiseCoef: number;
    denoiseCoef2: number;
    compareOn: boolean;
    splitRatio: number;
};

export async function initWebGPU(
    canvas: HTMLCanvasElement,
    videoURL: string,
    localVideo: Blob | null,
    settings: Settings
): Promise<() => void> {
    // Ваш исходный код WebGPU здесь
    // Я адаптирую его для работы в функции и добавлю необходимые изменения

    const adapter = await navigator.gpu.requestAdapter();

    if (adapter == null) {
        throw new Error('No WebGPU adapter found');
    }

    const device = await adapter.requestDevice();

    const context = canvas.getContext('webgpu') as GPUCanvasContext;
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format: presentationFormat,
        alphaMode: 'premultiplied',
    });

    // Создание видео элемента
    const video = document.createElement('video');
    video.loop = true;
    video.autoplay = true;
    video.muted = true;
    video.setAttribute('crossOrigin', 'anonymous');

    if (videoURL) {
        video.src = videoURL;
    } else if (localVideo) {
        video.src = URL.createObjectURL(localVideo);
    } else {
        throw new Error('No video source provided');
    }

    await video.play();

    const WIDTH = video.videoWidth || 1280;
    const HEIGHT = video.videoHeight || 720;

    const videoFrameTexture: GPUTexture = device.createTexture({
        size: [WIDTH, HEIGHT, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING
            | GPUTextureUsage.COPY_DST
            | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    function updateVideoFrameTexture() {
        device.queue.copyExternalImageToTexture(
            { source: video },
            { texture: videoFrameTexture },
            [WIDTH, HEIGHT],
        );
    }

    const compareBuffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const splitRatioBuffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Инициализация настроек сравнения
    device.queue.writeBuffer(compareBuffer, 0, new Uint32Array([settings.compareOn ? 1 : 0]));
    device.queue.writeBuffer(splitRatioBuffer, 0, new Float32Array([settings.splitRatio / 100]));

    // Создание кастомного пайплайна
    let customPipeline: Anime4KPipeline;
    function updatePipeline() {
        const pipelineDescriptor: Anime4KPipelineDescriptor = {
            device,
            inputTexture: videoFrameTexture,
        };
        const presetDescriptor: Anime4KPresetPipelineDescriptor = {
            ...pipelineDescriptor,
            nativeDimensions: {
                width: videoFrameTexture.width,
                height: videoFrameTexture.height,
            },
            targetDimensions: {
                width: canvas.width,
                height: canvas.height,
            },
        };
        switch (settings.effect) {
            case 'Original':
                customPipeline = new Original({ inputTexture: videoFrameTexture });
                break;
            case 'Upscale-CNNx2M':
                customPipeline = new CNNx2M(pipelineDescriptor);
                break;
            case 'Upscale-CNNx2UL':
                customPipeline = new CNNx2VL(pipelineDescriptor);
                break;
            case 'Restore-CNNM':
                customPipeline = new CNNM(pipelineDescriptor);
                break;
            case 'Restore-CNNL':
                customPipeline = new CNNVL(pipelineDescriptor);
                break;
            case 'Mode A':
                customPipeline = new ModeA(presetDescriptor);
                break;
            case 'Mode B':
                customPipeline = new ModeB(presetDescriptor);
                break;
            case 'Mode C':
                customPipeline = new ModeC(presetDescriptor);
                break;
            case 'Mode A+A':
                customPipeline = new ModeAA(presetDescriptor);
                break;
            case 'Mode B+B':
                customPipeline = new ModeBB(presetDescriptor);
                break;
            case 'Mode C+A':
                customPipeline = new ModeCA(presetDescriptor);
                break;
            default:
                console.log('Invalid selection');
                customPipeline = new Original({ inputTexture: videoFrameTexture });
                break;
        }
    }
    updatePipeline();

    function updateCanvasSize() {
        canvas.width = customPipeline.getOutputTexture().width;
        canvas.height = customPipeline.getOutputTexture().height;
        canvas.style.width = `100%`;
        canvas.style.height = `100%`;
    }
    updateCanvasSize();

    // Создание шейдеров
    const renderBindGroupLayout = device.createBindGroupLayout({
        label: 'Render Bind Group Layout',
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {},
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {},
            },
            {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' as GPUBufferBindingType },
            },
            {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {},
            },
            {
                binding: 4,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' as GPUBufferBindingType },
            },
        ],
    });

    const renderPipelineLayout = device.createPipelineLayout({
        label: 'Render Pipeline Layout',
        bindGroupLayouts: [renderBindGroupLayout],
    });

    const renderPipeline = device.createRenderPipeline({
        layout: renderPipelineLayout,
        vertex: {
            module: device.createShaderModule({
                code: fullscreenTexturedQuadWGSL,
            }),
            entryPoint: 'vert_main',
        },
        fragment: {
            module: device.createShaderModule({
                code: sampleExternalTextureWGSL,
            }),
            entryPoint: 'main',
            targets: [
                {
                    format: presentationFormat,
                },
            ],
        },
        primitive: {
            topology: 'triangle-list',
        },
    });

    // Создание сэмплера
    const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
    });

    // Создание Bind Group
    let renderBindGroup: GPUBindGroup;
    function updateRenderBindGroup() {
        renderBindGroup = device.createBindGroup({
            layout: renderBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: sampler,
                },
                {
                    binding: 1,
                    resource: customPipeline.getOutputTexture().createView(),
                },
                {
                    binding: 2,
                    resource: {
                        buffer: compareBuffer,
                    },
                },
                {
                    binding: 3,
                    resource: videoFrameTexture.createView(),
                },
                {
                    binding: 4,
                    resource: {
                        buffer: splitRatioBuffer,
                    },
                },
            ],
        });
    }

    updateRenderBindGroup();

    // Создание функции рендеринга одного кадра
    function oneFrame() {
        if (!video.paused) {
            return;
        }
        updateVideoFrameTexture();
        // инициализация командного энкодера
        const commandEncoder = device.createCommandEncoder();

        // выполнение compute pipeline
        customPipeline.pass(commandEncoder);

        // выполнение render pipeline
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    clearValue: {
                        r: 0.0,
                        g: 0.0,
                        b: 0.0,
                        a: 1.0,
                    },
                    loadOp: 'clear' as GPULoadOp,
                    storeOp: 'store' as GPUStoreOp,
                },
            ],
        });
        passEncoder.setPipeline(renderPipeline);
        passEncoder.setBindGroup(0, renderBindGroup);
        passEncoder.draw(6);
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);
    }

    // Создание функции рендеринга кадра
    function frame() {
        // обновление текстуры видео
        if (!video.paused) {
            updateVideoFrameTexture();
        }

        // инициализация командного энкодера
        const commandEncoder = device.createCommandEncoder();

        // выполнение compute pipeline
        customPipeline.pass(commandEncoder);

        // выполнение render pipeline
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    clearValue: {
                        r: 0.0,
                        g: 0.0,
                        b: 0.0,
                        a: 1.0,
                    },
                    loadOp: 'clear' as GPULoadOp,
                    storeOp: 'store' as GPUStoreOp,
                },
            ],
        });
        passEncoder.setPipeline(renderPipeline);
        passEncoder.setBindGroup(0, renderBindGroup);
        passEncoder.draw(6);
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);

        // Запрос следующего кадра
        video.requestVideoFrameCallback(frame);
    }

    // Запуск рендеринга
    video.requestVideoFrameCallback(frame);

    // Обновление пайплайна при изменении эффекта
    function updatePipelineAndRender() {
        updatePipeline();
        updateRenderBindGroup();
        updateCanvasSize();
        oneFrame();
    }

    // Обновление пайплайна при изменении настроек
    if (settings.effect) {
        updatePipelineAndRender();
    }

    // Возвращаем функцию очистки ресурсов
    const destroy = () => {
        video.pause();
        video.src = '';
        video.load();
        console.log('WebGPU Resources Destroyed');
    };

    return destroy;
}


const fullscreenTexturedQuadWGSL = `
struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) fragUV : vec2<f32>,
}

@vertex
fn vert_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
  const pos = array(
    vec2( 1.0,  1.0),
    vec2( 1.0, -1.0),
    vec2(-1.0, -1.0),
    vec2( 1.0,  1.0),
    vec2(-1.0, -1.0),
    vec2(-1.0,  1.0),
  );

  const uv = array(
    vec2(1.0, 0.0),
    vec2(1.0, 1.0),
    vec2(0.0, 1.0),
    vec2(1.0, 0.0),
    vec2(0.0, 1.0),
    vec2(0.0, 0.0),
  );

  var output : VertexOutput;
  output.Position = vec4(pos[VertexIndex], 0.0, 1.0);
  output.fragUV = uv[VertexIndex];
  return output;
}`;

const sampleExternalTextureWGSL = `
@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var tex_out: texture_2d<f32>;
@group(0) @binding(2) var<uniform> enable_comparison: u32;
@group(0) @binding(3) var tex_origin: texture_2d<f32>;
@group(0) @binding(4) var<uniform> splitRatio: f32;

@fragment
fn main(@location(0) fragUV: vec2<f32>) -> @location(0) vec4<f32> {
    let color_origin = textureSample(tex_origin, mySampler, fragUV);
    let color_out = textureSample(tex_out, mySampler, fragUV);
    // comparison split render
    if (enable_comparison == 1) {
        if (fragUV.x < splitRatio - 0.001) {
            // left half screen
            return color_origin;
        }
        if (fragUV.x < splitRatio + 0.001) {
            // red split bar
            return vec4f(1.0, 0, 0, 1.0);
        }
    }

    return color_out;
}
`;
