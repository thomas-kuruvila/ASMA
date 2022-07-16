import axios from 'axios';
import React, {useEffect, useState} from "react";
import {makeStyles} from "@material-ui/core/styles";
import {
    Card,
    Table,
    TableBody,
    TableCell,
    TableRow,
    Grid,
    Typography,
    IconButton,
    CircularProgress
} from "@material-ui/core";
import RefreshIcon from '@material-ui/icons/Refresh';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-cartesian-dist'
import {mergeDeepLeft} from "ramda";
import ContainerDimensions from "react-container-dimensions";
import {Player, BigPlayButton} from 'video-react';
import HLSSource from './components/HLSSource';
import "video-react/dist/video-react.css";

const Plot = createPlotlyComponent(Plotly);

const useStyle = makeStyles((theme) => ({
    fullWidth: {
        width: '100%',
    },
    withPadding: {
        padding: theme.spacing(1, 2),
    },
    marginTopLeft: {
        marginTop: theme.spacing(1),
        marginLeft: theme.spacing(2),
    },
    refreshButton: {
        position: 'absolute',
        top: theme.spacing(1),
        left: theme.spacing(1),
        zIndex: 10,
    }
}));

function CameraFeed({cameras}) {
    const classes = useStyle();
    const [time, _] = useState(new Date().toISOString()); // time is appended to live urls to prevent caching

    return (
        <Card className={classes.withPadding} variant="outlined">
            <Typography variant="h6" color="textSecondary">
                Camera Feed
            </Typography>
            {cameras ? (
                <Player muted={true} autoPlay={true}>
                    <HLSSource isVideoChild src={`${cameras[0].streams[0].src}?${time}`}/>
                    <BigPlayButton position="center" />
                </Player>
            ) : <CircularProgress/>}
        </Card>
    );
}

function StatsSimpleRow({label, value}) {
    return <TableRow>
        <TableCell component="th" scope="row">{label}</TableCell>
        <TableCell>{value}</TableCell>
    </TableRow>
}

function Status() {
    const classes = useStyle();
    const [time, _] = useState(new Date().toISOString());

    return (
        <Card variant="outlined">
            <Typography variant="h6" color="textSecondary" className={classes.marginTopLeft}>
                Status
            </Typography>
            <Table size="small">
                <TableBody>
                    <StatsSimpleRow label="Environment Score" value={12}/>
                    <StatsSimpleRow label="Time" value={time}/>
                    <StatsSimpleRow label="Camera IP" value="127.0.0.1"/>
                </TableBody>
            </Table>
        </Card>
    )
}

function BirdsView({cameras}) {
    const classes = useStyle();
    const [time, _] = useState(new Date().toISOString()); // time is appended to live urls to prevent caching

    return (
        <Card variant="outlined" className={classes.withPadding}>
            <Typography variant="h6" color="textSecondary">
                Bird's View
            </Typography>
            {cameras ? (
                <Player muted={true} autoPlay={true} fluid={false}>
                    <HLSSource isVideoChild src={`${cameras[0].streams[1].src}?${time}`}/>
                    <BigPlayButton position="center" />
                </Player>
            ) : <CircularProgress/>}
        </Card>
    );
}

function Charts({cameras}) {
    const classes = useStyle();
    const [data, setData] = useState(undefined)

    function update() {
        const headers = {'Cache-Control': 'no-store'};
        if (!cameras) {
            return
        }
        const url = `${cameras[0]['storage_host']}/static/data/${cameras[0]['id']}/objects_log/${new Date().toISOString().slice(0, 10)}.csv`;
        axios.get(url, {headers}).then(response => {
            let records = Plotly.d3.csv.parse(response.data);
            let x1 = [], y1 = [], y2 = [], env_score = [];
            records.forEach(function (element) {
                x1.push(element['Timestamp']);
                y1.push(element['DetectedObjects']);
                y2.push(element['ViolatingObjects']);
                env_score.push((element['EnvironmentScore']))
            });
            setData({x1, y1, y2, env_score});
        })
        // Plotly.d3.csv(, (records) => {
        // })
    }

    useEffect(() => {
        let intervalId = setInterval(update, 15000);  // refresh chart every 15 seconds
        return () => clearInterval(intervalId);
    }, [cameras]);
    useEffect(update, [cameras]);

    const [envScoreFigure, setEnvScoreFigure] = useState(undefined)

    useEffect(() => {
        if (!data) return;
        setEnvScoreFigure({
            data: [{
                x: data.x1,
                y: data.env_score,
                fill: 'tozeroy',
                type: 'scatter',
                name: 'Environment Score'
            }],
            layout: {
                title: 'Plotting log data Physical Distancing - Environment Score',
                height: 300,
            }
        })
    }, [data])

    const [pedestriansFigure, setPedestriansFigure] = useState(undefined)

    useEffect(() => {
        if (!data) return;
        let detected_pedestrians = {
            x: data.x1,
            y: data.y1,
            fill: 'tozeroy',
            type: 'scatter',
            name: 'Detected Pedestrians'
        };
        let detected_violating_pedestrians = {
            x: data.x1,
            y: data.y2,
            fill: 'tozeroy',
            type: 'scatter',
            name: 'Detected Pedestrians In Unsafe Area'
        };

        setPedestriansFigure({
            data: [detected_pedestrians, detected_violating_pedestrians],
            onInitialized: setPedestriansFigure,
            onUpdated: setPedestriansFigure,
            layout: {
                title: 'Plotting log data Physical Distancing',
                height: 300,
            }
        })
    }, [data])

    return (
        <Card variant="outlined" className={classes.withPadding}>
            {data ? (
                <ContainerDimensions>
                    {({width}) => (
                        <React.Fragment>
                            <IconButton className={classes.refreshButton} onClick={update}>
                                <RefreshIcon/>
                            </IconButton>
                            <Plot {...mergeDeepLeft(pedestriansFigure, {layout: {width: width - 20}})}/>
                            <Plot {...mergeDeepLeft(envScoreFigure, {layout: {width: width - 20}})}/>
                        </React.Fragment>
                    )}
                </ContainerDimensions>
            ) : ''}
        </Card>
    );
}

export default function Live() {
    const classes = useStyle();
    const [now, _] = useState(new Date().getTime())
    const [cameras, setCameras] = useState(undefined);
    useEffect(() => {
        axios.get('/api/cameras').then(response => setCameras(response.data))
    }, []);

    return (
        <Grid container spacing={3}>
            <Grid item xs={12} md={7}>
                <CameraFeed cameras={cameras}/>
            </Grid>
            <Grid item container xs={12} md={5} spacing={3}>
                {process.env.NODE_ENV === 'development' /* IN_PROGRESS */ ? (
                    <Grid item xs={12}>
                        <Status/>
                    </Grid>
                ) : null}
                <Grid item xs={12}>
                    <BirdsView cameras={cameras} />
                </Grid>
            </Grid>
            <Grid item xs={12}>
                <Charts cameras={cameras}/>
            </Grid>
        </Grid>
    );
}
