import * as fs from 'fs';
import * as path from 'path';
import { SignalMap } from './scanner';

export interface ChartConfig {
  appName: string;
  namespace: string;
  imageUri: string;
  containerPort: number;
  minReplicas?: number;
  maxReplicas?: number;
  workloadType?: 'deployment' | 'statefulset';
  storageSize?: string;
  storageClass?: string;
}

export function generateChart(outputDir: string, signals: SignalMap, config: ChartConfig): void {
  fs.mkdirSync(path.join(outputDir, 'templates'), { recursive: true });

  const imageRepo = parseImageRepo(config.imageUri);
  const imageTag = parseImageTag(config.imageUri);
  const minReplicas = config.minReplicas ?? 1;
  const maxReplicas = config.maxReplicas ?? 3;
  const isStatefulSet = config.workloadType === 'statefulset';

  writeFile(outputDir, 'Chart.yaml', chartYaml(config));
  writeFile(outputDir, 'values.yaml', valuesYaml(imageRepo, imageTag, config, minReplicas, maxReplicas));
  writeFile(outputDir, 'templates/_helpers.tpl', helpersTpl(config));

  if (isStatefulSet) {
    writeFile(outputDir, 'templates/statefulset.yaml', statefulSetYaml(signals, config));
  } else {
    writeFile(outputDir, 'templates/deployment.yaml', deploymentYaml(signals, config));
    writeFile(outputDir, 'templates/hpa.yaml', hpaYaml());
  }

  writeFile(outputDir, 'templates/service.yaml', serviceYaml(config));
  writeFile(outputDir, 'templates/ingress.yaml', ingressYaml());
  writeFile(outputDir, 'templates/serviceaccount.yaml', serviceAccountYaml());
  writeFile(outputDir, 'templates/externalsecret.yaml', externalSecretYaml());
}

function writeFile(base: string, rel: string, content: string): void {
  fs.writeFileSync(path.join(base, rel), content, 'utf8');
}

function parseImageRepo(imageUri: string): string {
  const colonIdx = imageUri.lastIndexOf(':');
  if (colonIdx === -1 || imageUri.lastIndexOf('/') > colonIdx) return imageUri;
  return imageUri.slice(0, colonIdx);
}

function parseImageTag(imageUri: string): string {
  const colonIdx = imageUri.lastIndexOf(':');
  if (colonIdx === -1 || imageUri.lastIndexOf('/') > colonIdx) return 'latest';
  return imageUri.slice(colonIdx + 1);
}

function chartYaml(config: ChartConfig): string {
  return [
    `apiVersion: v2`,
    `name: ${config.appName}`,
    `description: Helm chart for ${config.appName}`,
    `type: application`,
    `version: 0.1.0`,
    `appVersion: "1.0.0"`,
  ].join('\n') + '\n';
}

function valuesYaml(repo: string, tag: string, config: ChartConfig, minReplicas: number, maxReplicas: number): string {
  return `image:
  repository: "${repo}"
  tag: "${tag}"
  pullPolicy: IfNotPresent

replicaCount: 1

resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"

livenessProbe:
  httpGet:
    path: /healthz
    port: ${config.containerPort}
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: ${config.containerPort}
  initialDelaySeconds: 5
  periodSeconds: 5

service:
  port: ${config.containerPort}

ingress:
  enabled: true
  host: "${config.appName}.example.com"
  certificateArn: ""

serviceAccount:
  name: ""

hpa:
  minReplicas: ${minReplicas}
  maxReplicas: ${maxReplicas}
  cpuTargetPercent: 70

externalSecret:
  enabled: true
  secretStoreName: "aws-parameter-store"
`;
}

function helpersTpl(config: ChartConfig): string {
  return `{{- define "app.fullname" -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "app.labels" -}}
app.kubernetes.io/name: {{ include "app.fullname" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "app.fullname" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "app.serviceAccountName" -}}
{{- if .Values.serviceAccount.name }}{{ .Values.serviceAccount.name }}{{- else }}{{ include "app.fullname" . }}{{- end }}
{{- end }}
`;
}

function deploymentYaml(signals: SignalMap, config: ChartConfig): string {
  const envBlock = signals.envVarNames.length > 0
    ? signals.envVarNames.map(n => `        - name: ${n}\n          value: ""`).join('\n')
    : '';

  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "app.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "app.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "app.selectorLabels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ include "app.serviceAccountName" . }}
      containers:
        - name: {{ include "app.fullname" . }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - containerPort: ${config.containerPort}
              protocol: TCP
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          livenessProbe:
            {{- toYaml .Values.livenessProbe | nindent 12 }}
          readinessProbe:
            {{- toYaml .Values.readinessProbe | nindent 12 }}
${envBlock ? `          env:\n${envBlock}\n` : ''}`;
}

function statefulSetYaml(signals: SignalMap, config: ChartConfig): string {
  const envBlock = signals.envVarNames.length > 0
    ? signals.envVarNames.map(n => `        - name: ${n}\n          value: ""`).join('\n')
    : '';

  const storageSize = config.storageSize ?? '10Gi';
  const storageClass = config.storageClass ?? 'gp2';

  return `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: {{ include "app.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "app.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "app.selectorLabels" . | nindent 6 }}
  serviceName: {{ include "app.fullname" . }}
  template:
    metadata:
      labels:
        {{- include "app.selectorLabels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ include "app.serviceAccountName" . }}
      containers:
        - name: {{ include "app.fullname" . }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - containerPort: ${config.containerPort}
              protocol: TCP
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          livenessProbe:
            {{- toYaml .Values.livenessProbe | nindent 12 }}
          readinessProbe:
            {{- toYaml .Values.readinessProbe | nindent 12 }}
${envBlock ? `          env:\n${envBlock}\n` : ''}  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes:
          - ReadWriteOnce
        storageClassName: "${storageClass}"
        resources:
          requests:
            storage: "${storageSize}"
`;
}

function serviceYaml(config: ChartConfig): string {
  return `apiVersion: v1
kind: Service
metadata:
  name: {{ include "app.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "app.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  selector:
    {{- include "app.selectorLabels" . | nindent 4 }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: ${config.containerPort}
      protocol: TCP
`;
}

function ingressYaml(): string {
  return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "app.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "app.labels" . | nindent 4 }}
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    {{- if .Values.ingress.certificateArn }}
    alb.ingress.kubernetes.io/certificate-arn: {{ .Values.ingress.certificateArn }}
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    {{- end }}
spec:
  rules:
    - host: {{ .Values.ingress.host }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ include "app.fullname" . }}
                port:
                  number: {{ .Values.service.port }}
`;
}

function serviceAccountYaml(): string {
  return `apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "app.serviceAccountName" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "app.labels" . | nindent 4 }}
  annotations:
    eks.amazonaws.com/pod-identity-association: "true"
`;
}

function hpaYaml(): string {
  return `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "app.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "app.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "app.fullname" . }}
  minReplicas: {{ .Values.hpa.minReplicas }}
  maxReplicas: {{ .Values.hpa.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.hpa.cpuTargetPercent }}
`;
}

function externalSecretYaml(): string {
  return `apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: {{ include "app.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "app.labels" . | nindent 4 }}
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: {{ .Values.externalSecret.secretStoreName }}
    kind: ClusterSecretStore
  target:
    name: {{ include "app.fullname" . }}-secrets
    creationPolicy: Owner
  data:
    - secretKey: placeholder
      remoteRef:
        key: /{{ .Release.Namespace }}/{{ include "app.fullname" . }}/placeholder
`;
}
