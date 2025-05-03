import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Socket } from 'socket.io';
import { User } from 'src/modules/users/entities/user.entity';
import { Repository } from 'typeorm';

interface ConectedClients {
    [id: string]: {
        socket: Socket,
        user: User,

    }
}

@Injectable()
export class MessagesWsService {

    private connectedClients: ConectedClients = {}
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>
    ) { }

    async registerClient(client: Socket, userId: string) {

        const user = await this.userRepository.findOneBy({ id: userId });

        if (!user) throw new Error(`User not found`);
        if (!user.isActive) throw new Error(`User not active`);

        this.checkUserConnection(user);

        this.connectedClients[client.id] = {
            socket: client,
            user: user
        };
    }

    removeClient(clientId: string) {
        delete this.connectedClients[clientId];
    }

    getConnectedClients(): string[] {
        //console.log(this.connectedClients);
        return Object.keys(this.connectedClients);
    }

    getUserFullName(socketId: string) {
        return this.connectedClients[socketId].user.fullName;
    }

    private checkUserConnection(user: User) {
        for (const clientId of Object.keys(this.connectedClients)) {
            const connectedClients = this.connectedClients[clientId];

            if (connectedClients.user.id === user.id) {
                connectedClients.socket.disconnect();
                break;
            }
        }
    }
}
